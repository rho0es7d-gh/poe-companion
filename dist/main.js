"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        backgroundColor: "#0e0c0a",
        titleBarStyle: "hidden",
        titleBarOverlay: {
            color: "#0e0c0a",
            symbolColor: "#c8922a",
            height: 32,
        },
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true, // enable <webview> tag
        },
    });
    win.loadFile(path_1.default.join(__dirname, "index.html"));
    // Block new BrowserWindows from the main window itself
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    // Intercept window.open() calls from any <webview> inside the app.
    // When a webview tries to open a new window, deny it and instead
    // tell the renderer to open it as a new tab.
    electron_1.app.on("web-contents-created", (_event, contents) => {
        if (contents.getType() === "webview") {
            contents.setWindowOpenHandler(({ url }) => {
                // Send the URL to the renderer so it opens as a new tab
                win.webContents.send("open-in-new-tab", url);
                return { action: "deny" };
            });
        }
    });
}
electron_1.app.whenReady().then(() => {
    // Allow all content in webviews (so every site loads)
    electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const headers = { ...details.responseHeaders };
        // Remove headers that would block embedding
        delete headers["x-frame-options"];
        delete headers["X-Frame-Options"];
        delete headers["content-security-policy"];
        delete headers["Content-Security-Policy"];
        callback({ responseHeaders: headers });
    });
    createWindow();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
