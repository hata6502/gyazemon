import AutoLaunch from "auto-launch";
import chokidar from "chokidar";
import {
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  app,
  clipboard,
  dialog,
  ipcMain,
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
import { createWorker } from "tesseract.js";
import { pathToFileURL } from "url";

import { Watch, WatchV2, toWatchlistV2 } from "../watch-list";
import { getUploadOnceAvailable } from "./platform";

(async () => {
  if (process.env.npm_lifecycle_event !== "start") {
    const autoLaunch = new AutoLaunch({ name: "Gyazemon" });
    await autoLaunch.enable();
  }
  await app.whenReady();
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  }
  app.dock?.hide();
  app.on("window-all-closed", () => {});
  setUpdateNotification();

  const eventTarget = new EventTarget();

  const uploadedStore = new Store({ name: "uploaded" });
  const configStore = new Store();
  const watchlist = toWatchlistV2(
    ((await configStore.get("watchlist")) ?? []) as Watch[]
  );
  const rawGyazoAccessToken = await configStore.get("gyazoAccessToken");
  const gyazoAccessToken =
    typeof rawGyazoAccessToken === "string" && rawGyazoAccessToken;

  let onLine = false;
  ipcMain.handle("updateOnlineStatus", (_event, onLineEvent: boolean) => {
    onLine = onLineEvent;
    eventTarget.dispatchEvent(new Event(onLine ? "online" : "offline"));
  });

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

  let processingCount = 0;
  let uploadedList: { title: string; permalink_url: string }[] = [];
  const uploadQueue = new PQueue({ concurrency: 1 });
  const tray = new Tray(
    resolve(__dirname, "../../../resources/tray-icons/Template@2x.png")
  );
  const updateTray = () => {
    tray.setImage(
      resolve(
        __dirname,
        `../../../resources/tray-icons/${
          processingCount ? "processing" : ""
        }Template@2x.png`
      )
    );

    tray.setToolTip("Gyazemon");

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
        ...(getUploadOnceAvailable() && gyazoAccessToken
          ? [{ label: "Upload", click: uploadOnce }]
          : []),
        ...(queueLength
          ? [
              {
                label: `${
                  onLine ? "Uploading" : "Waiting for internet connection for"
                } ${queueLength} captures...`,
              },
            ]
          : []),
        ...uploadedList.map(({ title, permalink_url }) => ({
          label: title,
          click: () => shell.openExternal(permalink_url),
        })),
      ])
    );
  };

  const onlineStatusWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: resolve(__dirname, "../../preload/index.js"),
    },
  });
  await onlineStatusWindow.loadFile(
    resolve(__dirname, "../../../resources/online-status.html")
  );

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
      properties: ["openFile", "multiSelections"],
    });
    for (const filePath of filePaths) {
      receive({ path: filePath, checksFileID: false });
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
      ...new Uint8Array(
        await crypto.subtle.digest("SHA-256", new Uint8Array(file))
      ),
    ]
      .map((uint8) => uint8.toString(16).padStart(2, "0"))
      .join("");
    log.info("File ID", fileID);
    if (event.checksFileID && uploadedStore.get(fileID)) {
      return;
    }

    log.debug("processing");
    processingCount++;
    updateTray();
    try {
      log.debug("load");
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
      updateTray();

      if (event.writesClipboard) {
        clipboard.writeText(firstUploadResponse.permalink_url);
      }

      // Store minimal data
      uploadedStore.set(fileID, true);
    } catch (exception) {
      log.error(exception);
      new Notification({
        title: "Failed to upload to Gyazo. ",
        body: `${event.path}\nPlease check the log. `,
      }).show();
    } finally {
      processingCount--;
      updateTray();
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
        log.debug("Start loading PDF");
        const browserWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            preload: resolve(__dirname, "../../preload/index.js"),
          },
        });

        log.debug("Start rendering PDF");
        const pageImages = await new Promise<Buffer[]>(
          async (resolvePromise) => {
            const pageImages: Buffer[] = [];
            ipcMain.handleOnce("getPDF", (): ArrayBuffer => {
              log.debug("getPDF");
              return new Uint8Array(file).buffer;
            });
            ipcMain.handle("setPageImage", (_event, pageImage: ArrayBuffer) => {
              pageImages.push(Buffer.from(pageImage));
              log.info(`Rendered page ${pageImages.length}. `);
            });
            ipcMain.handleOnce("finishRenderPDF", () => {
              ipcMain.removeHandler("setPageImage");
              resolvePromise(pageImages);
            });

            log.debug("Load pdf.html");
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

          const basisFontSize = 28;
          const detectedFontSize = await detectFontSize(loadedData);
          const zoom = Math.min(
            Math.max(basisFontSize / (detectedFontSize ?? basisFontSize), 0.4),
            2.5
          );
          // Retina display
          const scale = 2 / zoom;
          log.debug("zoom", zoom);

          formData.append("access_token", gyazoAccessToken);
          formData.append(
            "imagedata",
            new Blob([new Uint8Array(loadedData)]),
            "dummy.png"
          );
          formData.append("referer_url", String(url));
          formData.append("app", "Gyazemon");
          formData.append("title", title);
          formData.append("desc", description);
          formData.append(
            "created_at",
            String(mtimeMs / 1000 - loadedDataIndex)
          );
          formData.append("scale", String(scale));

          let uploadResponse;
          for (
            let uploadRetryCount = 0;
            uploadRetryCount < 3;
            uploadRetryCount++
          ) {
            try {
              uploadResponse = await uploadQueue.add(async () => {
                if (!onLine) {
                  await new Promise((resolve) => {
                    eventTarget.addEventListener("online", resolve, {
                      once: true,
                    });
                  });
                }

                return fetch("https://upload.gyazo.com/api/upload", {
                  method: "POST",
                  body: formData,
                  signal: AbortSignal.timeout(3 * 60 * 1000),
                });
              });
            } catch {
              continue;
            }

            if (uploadResponse.ok) {
              break;
            }
            // Rate Limits https://gyazo.com/api/docs/errors
            if (uploadResponse.status === 429) {
              uploadQueue.clear();
              updateTray();

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

  const detectFontSize = async (loadedData: Buffer) => {
    // https://help.gyazo.com/--5de75e1e040e1d0017df436d
    // https://github.com/tesseract-ocr/tessdata_fast?tab=readme-ov-file#example---jpn-and--japanese
    const tesseractWorker = await createWorker(["jpn"]);
    try {
      const recognizeResult = await Promise.race([
        tesseractWorker.recognize(loadedData, undefined, { blocks: true }),
        new Promise<void>((resolve) => setTimeout(resolve, 5 * 1000)),
      ]);
      if (!recognizeResult) {
        return;
      }

      const lines =
        recognizeResult.data.blocks
          ?.flatMap(({ paragraphs }) =>
            paragraphs.flatMap(({ lines }) => lines)
          )
          .filter(({ confidence }) => confidence >= 80) ?? [];
      const charCount = lines.reduce(
        (sum, { text }) => sum + [...new Intl.Segmenter().segment(text)].length,
        0
      );
      if (!charCount) {
        return;
      }

      const averageRowHeight =
        lines.reduce(
          (sum, { rowAttributes, text }) =>
            sum +
            // @ts-expect-error
            rowAttributes.rowHeight *
              [...new Intl.Segmenter().segment(text)].length,
          0
        ) / charCount;

      return averageRowHeight;
    } finally {
      await tesseractWorker.terminate();
    }
  };

  updateTray();
  uploadQueue.on("add", updateTray);
  uploadQueue.on("next", updateTray);
  eventTarget.addEventListener("online", updateTray);
  eventTarget.addEventListener("offline", updateTray);

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
