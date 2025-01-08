import { contextBridge, ipcRenderer } from "electron";

const api = {
  updateOnlineStatus: (onLine: boolean): Promise<void> =>
    ipcRenderer.invoke("updateOnlineStatus", onLine),

  selectDirectory: (): Promise<string[]> =>
    ipcRenderer.invoke("selectDirectory"),
  restart: (): Promise<void> => ipcRenderer.invoke("restart"),

  getFromConfigStore: (key: string): Promise<unknown> =>
    ipcRenderer.invoke("getFromConfigStore", key),
  setToConfigStore: (key: string, value?: unknown): Promise<void> =>
    ipcRenderer.invoke("setToConfigStore", key, value),

  getPDF: (): Promise<ArrayBuffer> => ipcRenderer.invoke("getPDF"),
  setPageImage: (pageImage: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke("setPageImage", pageImage),
  finishRenderPDF: (): Promise<void> => ipcRenderer.invoke("finishRenderPDF"),
};
export type ElectronAPI = typeof api;
contextBridge.exposeInMainWorld("electronAPI", api);
