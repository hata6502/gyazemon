import { ElectronAPI } from "../preload";

declare global {
  var electronAPI: ElectronAPI;
}
