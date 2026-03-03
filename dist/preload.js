"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    onOpenInNewTab: (callback) => {
        electron_1.ipcRenderer.on("open-in-new-tab", (_event, url) => callback(url));
    },
    navigateTo: (url) => {
        electron_1.ipcRenderer.send("navigate-to", url);
    },
});
