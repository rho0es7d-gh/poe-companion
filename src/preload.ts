import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  onOpenInNewTab: (callback: (url: string) => void) => {
    ipcRenderer.on("open-in-new-tab", (_event, url: string) => callback(url));
  },
  navigateTo: (url: string) => {
    ipcRenderer.send("navigate-to", url);
  },
});