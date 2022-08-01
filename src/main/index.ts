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
import FormData from "form-data";
import { readFile, rename, stat } from "fs/promises";
import fetch from "node-fetch";
import { hostname, userInfo } from "os";
import PQueue from "p-queue";
import { basename, dirname, extname, resolve } from "path";
import { pathToFileURL } from "url";

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
      resolve(__dirname, "../../resources/trayTemplate@2x.png")
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
        preload: resolve(__dirname, "../preload/index.js"),
      },
    });
    settingsWindow.setMenu(null);
    await settingsWindow.loadFile(
      resolve(__dirname, "../../resources/settings.html")
    );
    settingsWindow.on("closed", () => {
      settingsWindow = undefined;
    });
  };

  let aboutWindow: BrowserWindow | undefined;
  const queue = new PQueue({ concurrency: 1 });
  let uploadedList: { title: string; permalink_url: string }[] = [];
  const setTrayMenu = () => {
    const queueLength = queue.pending + queue.size;
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
              icon_path: resolve(__dirname, "../../resources/icon.png"),
              package_json_dir: resolve(__dirname, "../.."),
            });
            aboutWindow.on("closed", () => {
              aboutWindow = undefined;
            });
          },
        },
        { role: "quit" },
        { type: "separator" },
        ...(queueLength
          ? [{ label: `Uploading ${queueLength} files...` }]
          : []),
        ...uploadedList.map(({ title, permalink_url }) => ({
          label: title,
          click: () => shell.openExternal(permalink_url),
        })),
      ])
    );
  };
  setTrayMenu();
  queue.on("add", setTrayMenu);
  queue.on("next", setTrayMenu);

  const watchlist = (await store.get("watchlist")) ?? [];
  if (!Array.isArray(watchlist)) {
    throw new Error("watchlist is not array. ");
  }

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
    type AvailableExt = typeof availableExts[number];

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
              preload: resolve(__dirname, "../preload/index.js"),
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
                resolve(__dirname, "../../resources/pdf.html")
              );
            }
          );
          browserWindow.close();

          log.info("Rendered. ");
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
      ext,
      path,
    }: {
      ext: AvailableExt;
      path: string;
    }) => {
      debounceCounts.delete(path);

      try {
        const { mtimeMs } = await stat(path);
        const loadedDataList = await load({ ext, path });
        const uploadResponses = [];
        for (const [loadedDataIndex, loadedData] of loadedDataList.entries()) {
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
          formData.append("imagedata", loadedData, "dummy.png");
          formData.append("referer_url", String(url));
          formData.append("app", "gyazemon");
          formData.append("title", title);
          formData.append("desc", description);
          formData.append("created_at", mtimeMs / 1000 - loadedDataIndex);

          const uploadResponse = await fetch(
            "https://upload.gyazo.com/api/upload",
            { method: "POST", body: formData }
          );
          if (!uploadResponse.ok) {
            // https://gyazo.com/api/docs/errors
            if (uploadResponse.status === 429) {
              queue.clear();
              new Notification({
                title: "Canceled the upload processes to Gyazo. ",
                body: "Gyazo API rate limit exceeded. Please try again later. ",
              }).show();
            }

            throw new Error(
              `Upload error. ${uploadResponse.status} ${uploadResponse.statusText}`
            );
          }
          uploadResponses.push(uploadResponse);

          log.info("Uploaded. ");
        }

        uploadedList = [
          { ...(await uploadResponses[0].json()), title: basename(path) },
          ...uploadedList,
        ].slice(0, 10);

        await rename(
          path,
          resolve(dirname(path), `(Uploaded)${basename(path)}`)
        );
      } catch (exception) {
        log.error(exception);
        new Notification({
          title: "Failed to upload to Gyazo. ",
          body: `${path}\nPlease check the log. `,
        }).show();
      }
    };

    const handleEvent = async (path: string) => {
      if (basename(path).startsWith("(Uploaded)")) {
        return;
      }

      const ext = extname(path);
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

      const debounceCount = debounceCounts.get(path) ?? 0;
      debounceCounts.set(path, debounceCount + 1);
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
        prevDebounceCount = debounceCounts.get(path);
        await new Promise((resolve) => setTimeout(resolve, debounceTime));
      } while (debounceCounts.get(path) !== prevDebounceCount);

      await queue.add(() => upload({ ext: availableExt, path }));
    };

    for (const path of watchlist) {
      chokidar
        .watch(path, { ignoreInitial: true })
        .on("add", (path) => handleEvent(path))
        .on("change", (path) => handleEvent(path))
        .on("ready", () => log.info(`Watching ${path} ...`));
    }
  } else {
    await openSettingsWindow();
  }
})();
