"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
// A. Ad-Blocking List
const adFilter = {
    urls: [
        "*://*.doubleclick.net/*",
        "*://*.googlesyndication.com/*",
        "*://*.google-analytics.com/*",
        "*://*.adnxs.com/*",
        "*://*.quantserve.com/*",
        "*://*.rubiconproject.com/*",
        "*://*.criteo.com/*",
        "*://*.amazon-adsystem.com/*"
    ]
};
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        backgroundColor: "#0e0c0a",
        // darkTheme: true is deprecated on some platforms, nativeTheme (below) is better
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
            webviewTag: true,
        },
    });
    win.loadFile(path_1.default.join(__dirname, "index.html"));
    // Block new native windows from the main app container
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    // B. Fixing "Target=_blank" Links
    electron_1.app.on("web-contents-created", (_event, contents) => {
        if (contents.getType() === "webview") {
            contents.setWindowOpenHandler(({ url }) => {
                win.webContents.send("open-in-new-tab", url);
                return { action: "deny" };
            });
            contents.on('will-navigate', (event, url) => {
                // Allow internal navigation
            });
        }
    });
}
electron_1.app.whenReady().then(() => {
    // NEW: Force the entire app (and webviews) into Dark Mode
    electron_1.nativeTheme.themeSource = "dark";
    // A. Register Ad-Blocker
    electron_1.session.defaultSession.webRequest.onBeforeRequest(adFilter, (details, callback) => {
        callback({ cancel: true });
    });
    // Allow embedding by stripping headers
    electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const headers = { ...details.responseHeaders };
        delete headers["x-frame-options"];
        delete headers["X-Frame-Options"];
        delete headers["content-security-policy"];
        delete headers["Content-Security-Policy"];
        callback({ responseHeaders: headers });
    });
    // D. Context Menu Handler (Right Click)
    electron_1.ipcMain.on("show-context-menu", (event, params) => {
        const template = [];
        // 1. Link Actions
        if (params.linkURL) {
            template.push({
                label: "Copy Link Address",
                click: () => electron_1.clipboard.writeText(params.linkURL),
            });
        }
        // 2. Image Actions
        if (params.mediaType === "image" && params.srcURL) {
            template.push({
                label: "Copy Image Address",
                click: () => electron_1.clipboard.writeText(params.srcURL),
            });
        }
        // 3. Selection Actions
        if (params.selectionText) {
            template.push({ role: "copy" });
        }
        // Separator if we have added anything above
        if (template.length > 0) {
            template.push({ type: "separator" });
        }
        // 4. General Actions
        template.push({
            label: "Copy Page URL",
            click: () => electron_1.clipboard.writeText(params.pageURL),
        });
        // 5. Navigation & DevTools
        template.push({ type: "separator" }, { label: "Back", enabled: params.editFlags.canGoBack, click: () => event.sender.goBack() }, { label: "Forward", enabled: params.editFlags.canGoForward, click: () => event.sender.goForward() }, { label: "Reload", click: () => event.sender.reload() });
        const menu = electron_1.Menu.buildFromTemplate(template);
        // We need to show the menu attached to the window that sent the event
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (win) {
            menu.popup({ window: win });
        }
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
