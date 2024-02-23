import AutoLaunch from "auto-launch";
import chokidar from "chokidar";
import {
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  app,
  dialog,
  ipcMain,
  nativeImage,
  shell,
} from "electron";
import openAboutWindow from "electron-about-window";
import log from "electron-log";
import Store from "electron-store";
import { setUpdateNotification } from "electron-update-notifier";
import { readFile, stat } from "fs/promises";
import { hostname, userInfo } from "os";
import PQueue from "p-queue";
import { basename, extname, resolve } from "path";
import { pathToFileURL } from "url";
import { Watch, WatchV2, toWatchlistV2 } from "../watch-list";

(async () => {
  if (process.env.npm_lifecycle_event !== "start") {
    const autoLaunch = new AutoLaunch({ name: "gyazemon" });
    await autoLaunch.enable();
  }

  await app.whenReady();
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  }
  app.dock?.hide();
  app.on("window-all-closed", () => {});
  setUpdateNotification();

  const uploadedStore = new Store({ name: "uploaded" });

  const configStore = new Store();
  const watchlist = toWatchlistV2(
    ((await configStore.get("watchlist")) ?? []) as Watch[]
  );
  const rawGyazoAccessToken = await configStore.get("gyazoAccessToken");
  const gyazoAccessToken =
    typeof rawGyazoAccessToken === "string" && rawGyazoAccessToken;

  ipcMain.handle("getFromConfigStore", (_event, key: string) =>
    configStore.get(key)
  );

  ipcMain.handle("setToConfigStore", (_event, key: string, value?: unknown) =>
    configStore.set(key, value)
  );

  ipcMain.handle("selectDirectory", async () => {
    if (!settingsWindow) {
      throw new Error("settingsWindow is not set. ");
    }
    const { filePaths } = await dialog.showOpenDialog(settingsWindow, {
      properties: ["openDirectory"],
    });
    return filePaths;
  });

  ipcMain.handle("restart", () => {
    app.relaunch();
    new Notification({ title: "Gyazemon is restarted. " }).show();

    app.quit();
  });

  const tray = new Tray(
    nativeImage.createFromPath(
      resolve(__dirname, "../../../resources/trayTemplate@2x.png")
    )
  );
  tray.setToolTip("gyazemon");

  const uploadQueue = new PQueue({ concurrency: 1 });
  let uploadedList: { title: string; permalink_url: string }[] = [];
  const setTrayMenu = () => {
    const queueLength = uploadQueue.pending + uploadQueue.size;
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Settings",
          click: openSettings,
        },
        {
          label: "About",
          click: openAbout,
        },
        { role: "quit" },
        { type: "separator" },
        ...(gyazoAccessToken ? [{ label: "Upload", click: uploadOnce }] : []),
        ...(queueLength
          ? [{ label: `Uploading ${queueLength} captures...` }]
          : []),
        ...uploadedList.map(({ title, permalink_url }) => ({
          label: title,
          click: () => shell.openExternal(permalink_url),
        })),
      ])
    );
  };

  let settingsWindow: BrowserWindow | undefined;
  const openSettings = async () => {
    if (settingsWindow) {
      settingsWindow.show();
      return;
    }

    settingsWindow = new BrowserWindow({
      width: 640,
      height: 480,
      webPreferences: {
        preload: resolve(__dirname, "../../preload/index.js"),
      },
    });
    settingsWindow.setMenu(null);
    await settingsWindow.loadFile(
      resolve(__dirname, "../../../resources/settings.html")
    );
    settingsWindow.on("closed", () => {
      settingsWindow = undefined;
    });
  };

  let aboutWindow: BrowserWindow | undefined;
  const openAbout = () => {
    if (aboutWindow) {
      aboutWindow.show();
      return;
    }

    aboutWindow = openAboutWindow({
      icon_path: resolve(__dirname, "../../../resources/icon.png"),
      package_json_dir: resolve(__dirname, "../../.."),
    });
    aboutWindow.on("closed", () => {
      aboutWindow = undefined;
    });
  };

  const uploadOnce = async () => {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ["multiSelections", "openFile"],
    });
    for (const filePath of filePaths) {
      receive({ path: filePath, opensNewTab: false, checksFileID: false });
    }
  };

  const receive = async (event: WatchV2 & { checksFileID: boolean }) => {
    const ext = extname(event.path);
    switch (ext) {
      case ".gif":
      case ".jpeg":
      case ".jpg":
      case ".png":
      case ".webp":

      case ".pdf": {
        break;
      }

      default: {
        return;
      }
    }

    const { mtimeMs, size } = await stat(event.path);
    if (!size) {
      return;
    }

    const file = await readFile(event.path);
    const fileID = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", file)),
    ]
      .map((uint8) => uint8.toString(16).padStart(2, "0"))
      .join("");
    log.info("File ID", fileID);
    if (event.checksFileID && uploadedStore.get(fileID)) {
      return;
    }

    try {
      const loadedDataList = await load({ ext, file });
      if (!loadedDataList.length) {
        return;
      }

      const firstUploadResponse = await upload({
        loadedDataList,
        mtimeMs,
        path: event.path,
      });

      uploadedList = [
        { ...firstUploadResponse, title: basename(event.path) },
        ...uploadedList,
      ].slice(0, 10);
      setTrayMenu();
      if (event.opensNewTab) {
        shell.openExternal(firstUploadResponse.permalink_url);
      }

      // Store minimal data
      uploadedStore.set(fileID, true);
    } catch (exception) {
      log.error(exception);
      new Notification({
        title: "Failed to upload to Gyazo. ",
        body: `${event.path}\nPlease check the log. `,
      }).show();
    }
  };

  const load = async ({
    ext,
    file,
  }: {
    ext: ".gif" | ".jpeg" | ".jpg" | ".png" | ".webp" | ".pdf";
    file: Buffer;
  }) => {
    switch (ext) {
      case ".gif":
      case ".jpeg":
      case ".jpg":
      case ".png":
      case ".webp": {
        return [file];
      }

      case ".pdf": {
        const browserWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            offscreen: true,
            preload: resolve(__dirname, "../../preload/index.js"),
          },
        });

        const pageImages = await new Promise<Buffer[]>(
          async (resolvePromise) => {
            const pageImages: Buffer[] = [];
            ipcMain.handleOnce("getPDF", (): ArrayBuffer => file);
            ipcMain.handle("setPageImage", (_event, pageImage: ArrayBuffer) => {
              pageImages.push(Buffer.from(pageImage));
              log.info(`Rendered page ${pageImages.length}. `);
            });
            ipcMain.handleOnce("finishRenderPDF", () => {
              ipcMain.removeHandler("setPageImage");
              resolvePromise(pageImages);
            });

            await browserWindow.loadFile(
              resolve(__dirname, "../../../resources/pdf.html")
            );
          }
        );
        browserWindow.close();

        return pageImages;
      }

      default: {
        throw new Error(`Unknown ext: ${ext satisfies never}`);
      }
    }
  };

  const upload = async ({
    loadedDataList,
    mtimeMs,
    path,
  }: {
    loadedDataList: Buffer[];
    mtimeMs: number;
    path: string;
  }) => {
    if (!gyazoAccessToken) {
      throw new Error("Gyazo access token is not set. ");
    }

    const uploadResponses = await Promise.all(
      [...loadedDataList.entries()].map(
        async ([loadedDataIndex, loadedData]) => {
          const oneBasedLoadedDataIndex = loadedDataIndex + 1;
          log.info(`Uploading ${oneBasedLoadedDataIndex} of ${path} ...`);

          const formData = new FormData();
          const title =
            loadedDataList.length < 2
              ? basename(path)
              : `${oneBasedLoadedDataIndex}/${loadedDataList.length} ${basename(
                  path
                )}`;

          const description = `${title}
`;

          // Use http scheme instead of unsupported file scheme.
          const url = new URL("http://localhost/");
          url.protocol = "http:";
          url.username = userInfo().username;
          url.hostname = hostname();
          url.pathname = pathToFileURL(path).pathname;

          formData.append("access_token", gyazoAccessToken);
          formData.append("imagedata", new Blob([loadedData]), "dummy.png");
          formData.append("referer_url", String(url));
          formData.append("app", "gyazemon");
          formData.append("title", title);
          formData.append("desc", description);
          formData.append(
            "created_at",
            String(mtimeMs / 1000 - loadedDataIndex)
          );

          let uploadResponse;
          for (
            let uploadRetryCount = 0;
            uploadRetryCount < 3;
            uploadRetryCount++
          ) {
            try {
              uploadResponse = await uploadQueue.add(() =>
                fetch("https://upload.gyazo.com/api/upload", {
                  method: "POST",
                  body: formData,
                  signal: AbortSignal.timeout(3 * 60 * 1000),
                })
              );
            } catch {
              continue;
            }

            if (uploadResponse.ok) {
              break;
            }
            // Rate Limits https://gyazo.com/api/docs/errors
            if (uploadResponse.status === 429) {
              uploadQueue.clear();
              setTrayMenu();

              new Notification({
                title: "Canceled the upload processes to Gyazo. ",
                body: "Gyazo API rate limit exceeded. Please try again later. ",
              }).show();
              break;
            }
          }
          if (!uploadResponse || !uploadResponse.ok) {
            throw new Error(
              `Upload error. ${uploadResponse?.status ?? ""} ${
                uploadResponse?.statusText ?? ""
              }`
            );
          }

          log.info(`Uploaded ${oneBasedLoadedDataIndex} of ${path}`);
          return uploadResponse;
        }
      )
    );

    return uploadResponses[0].json();
  };

  setTrayMenu();
  uploadQueue.on("add", setTrayMenu);
  uploadQueue.on("next", setTrayMenu);

  if (gyazoAccessToken) {
    for (const watch of watchlist) {
      const handle = (path: string) =>
        receive({ ...watch, path, checksFileID: true });
      chokidar
        .watch(watch.path, { awaitWriteFinish: true, ignoreInitial: true })
        .on("add", handle)
        .on("change", handle)
        .on("ready", () => log.info(`Watching ${watch.path} ...`));
    }
  } else {
    await openSettings();
  }
})();
