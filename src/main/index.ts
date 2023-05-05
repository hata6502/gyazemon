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
import FormData from "form-data";
import { readFile, rename, stat } from "fs/promises";
import fetch from "node-fetch";
import { hostname, userInfo } from "os";
import PQueue from "p-queue";
import { basename, dirname, extname, resolve } from "path";
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

  const store = new Store();
  ipcMain.handle("getFromStore", (_event, key: string) => store.get(key));
  ipcMain.handle("setToStore", (_event, key: string, value?: unknown) =>
    store.set(key, value)
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

  let settingsWindow: BrowserWindow | undefined;
  const openSettingsWindow = async () => {
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
  // Rate Limits https://gyazo.com/api/docs/errors
  const uploadQueue = new PQueue({
    interval: 10 * 60 * 1000,
    intervalCap: 86,
  });
  let uploadedList: { title: string; permalink_url: string }[] = [];
  const setTrayMenu = () => {
    const queueLength = uploadQueue.pending + uploadQueue.size;
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Settings",
          click: openSettingsWindow,
        },
        {
          label: "About",
          click: () => {
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
          },
        },
        { role: "quit" },
        { type: "separator" },
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
  setTrayMenu();
  uploadQueue.on("add", setTrayMenu);
  uploadQueue.on("next", setTrayMenu);

  const watchlist = toWatchlistV2(
    ((await store.get("watchlist")) ?? []) as Watch[]
  );

  const gyazoAccessToken = await store.get("gyazoAccessToken");
  if (typeof gyazoAccessToken === "string" && gyazoAccessToken !== "") {
    const availableExts = [
      ".gif",
      ".jpeg",
      ".jpg",
      ".png",
      ".webp",
      ".pdf",
    ] as const;
    type AvailableExt = (typeof availableExts)[number];

    const load = async ({ ext, path }: { ext: AvailableExt; path: string }) => {
      switch (ext) {
        case ".gif":
        case ".jpeg":
        case ".jpg":
        case ".png":
        case ".webp": {
          return [await readFile(path)];
        }

        case ".pdf": {
          log.info(`Rendering ${path} ...`);

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
              ipcMain.handleOnce(
                "getPDF",
                (): Promise<ArrayBuffer> => readFile(path)
              );
              ipcMain.handle(
                "setPageImage",
                (_event, pageImage: ArrayBuffer) => {
                  pageImages.push(Buffer.from(pageImage));
                  log.info(`Rendered page ${pageImages.length}. `);
                }
              );
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

          log.info(`Rendered ${path}`);
          return pageImages;
        }

        default: {
          const exhaustiveCheck: never = ext;
          throw new Error(`Unknown ext: ${exhaustiveCheck}`);
        }
      }
    };

    const debounceCounts = new Map<string, number>();
    const upload = async ({
      path,
      opensNewTab,
      ext,
    }: WatchV2 & { ext: AvailableExt }) => {
      debounceCounts.delete(path);

      try {
        const { mtimeMs, size } = await stat(path);
        if (!size) {
          return;
        }

        const loadedDataList = await load({ ext, path });
        const uploadResponses = await Promise.all(
          [...loadedDataList.entries()].map(
            async ([loadedDataIndex, loadedData]) => {
              const oneBasedLoadedDataIndex = loadedDataIndex + 1;
              log.info(`Uploading ${oneBasedLoadedDataIndex} of ${path} ...`);

              const formData = new FormData();
              const title =
                loadedDataList.length < 2
                  ? basename(path)
                  : `${oneBasedLoadedDataIndex}/${
                      loadedDataList.length
                    } ${basename(path)}`;

              const description = `${title}
`;

              // Use http scheme instead of unsupported file scheme.
              const url = new URL("http://localhost/");
              url.protocol = "http:";
              url.username = userInfo().username;
              url.hostname = hostname();
              url.pathname = pathToFileURL(path).pathname;

              formData.append("access_token", gyazoAccessToken);
              formData.append("imagedata", loadedData, "dummy.png");
              formData.append("referer_url", String(url));
              formData.append("app", "gyazemon");
              formData.append("title", title);
              formData.append("desc", description);
              formData.append("created_at", mtimeMs / 1000 - loadedDataIndex);

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

        const firstUploadResponse = await uploadResponses[0].json();
        uploadedList = [
          { ...firstUploadResponse, title: basename(path) },
          ...uploadedList,
        ].slice(0, 10);

        await rename(
          path,
          resolve(dirname(path), `(Uploaded)${basename(path)}`)
        );

        if (opensNewTab) {
          shell.openExternal(firstUploadResponse.permalink_url);
        }
      } catch (exception) {
        log.error(exception);
        new Notification({
          title: "Failed to upload to Gyazo. ",
          body: `${path}\nPlease check the log. `,
        }).show();
      }
    };

    const handleEvent = async (watch: WatchV2) => {
      if (basename(watch.path).startsWith("(Uploaded)")) {
        return;
      }

      const ext = extname(watch.path);
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
      const availableExt: AvailableExt extends typeof ext
        ? AvailableExt
        : never = ext;

      const debounceCount = debounceCounts.get(watch.path) ?? 0;
      debounceCounts.set(watch.path, debounceCount + 1);
      if (debounceCount) {
        return;
      }

      const debounceTime = {
        ".gif": 500,
        ".jpeg": 500,
        ".jpg": 500,
        ".png": 500,
        ".webp": 500,

        ".pdf": 500,
      }[availableExt];
      let prevDebounceCount;
      do {
        prevDebounceCount = debounceCounts.get(watch.path);
        await new Promise((resolve) => setTimeout(resolve, debounceTime));
      } while (debounceCounts.get(watch.path) !== prevDebounceCount);

      await upload({ ...watch, ext: availableExt });
    };

    for (const watch of watchlist) {
      chokidar
        .watch(watch.path, { ignoreInitial: true })
        .on("add", (path) => handleEvent({ ...watch, path }))
        .on("change", (path) => handleEvent({ ...watch, path }))
        .on("ready", () => log.info(`Watching ${watch.path} ...`));
    }
  } else {
    await openSettingsWindow();
  }
})();
