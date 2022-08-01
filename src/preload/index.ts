import { contextBridge, ipcRenderer } from "electron";

const api = {
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, args),
  selectDirectory: (): Promise<string[]> =>
    ipcRenderer.invoke("selectDirectory"),
  restart: (): Promise<void> => ipcRenderer.invoke("restart"),

  getFromStore: (key: string): Promise<unknown> =>
    ipcRenderer.invoke("getFromStore", key),
  setToStore: (key: string, value?: unknown): Promise<void> =>
    ipcRenderer.invoke("setToStore", key, value),

  getPDF: (): Promise<ArrayBuffer> => ipcRenderer.invoke("getPDF"),
  setPageImage: (pageImage: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke("setPageImage", pageImage),
  finishRenderPDF: (): Promise<void> => ipcRenderer.invoke("finishRenderPDF"),
};
export type ElectronAPI = typeof api;
contextBridge.exposeInMainWorld("electronAPI", api);
