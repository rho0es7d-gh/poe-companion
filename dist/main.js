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
            // New window → open as tab in renderer
            contents.setWindowOpenHandler(({ url }) => {
                win.webContents.send("open-in-new-tab", url);
                return { action: "deny" };
            });
            // Right-click context menu — build menu here so Back/Forward/Reload
            // correctly target THIS webview's webContents, not the main window
            contents.on("context-menu", (_e, params) => {
                const template = [];
                if (params.linkURL) {
                    template.push({
                        label: "Open Link in New Tab",
                        click: () => win.webContents.send("open-in-new-tab", params.linkURL),
                    });
                    template.push({
                        label: "Copy Link Address",
                        click: () => electron_1.clipboard.writeText(params.linkURL),
                    });
                }
                if (params.mediaType === "image" && params.srcURL) {
                    template.push({
                        label: "Copy Image Address",
                        click: () => electron_1.clipboard.writeText(params.srcURL),
                    });
                }
                if (params.selectionText) {
                    template.push({ role: "copy" });
                }
                if (template.length > 0)
                    template.push({ type: "separator" });
                template.push({
                    label: "Copy Page URL",
                    click: () => electron_1.clipboard.writeText(params.pageURL),
                });
                template.push({ type: "separator" });
                // These now correctly call contents (the webview), not event.sender (the shell)
                template.push({
                    label: "Back",
                    enabled: contents.canGoBack(),
                    click: () => contents.goBack(),
                }, {
                    label: "Forward",
                    enabled: contents.canGoForward(),
                    click: () => contents.goForward(),
                }, {
                    label: "Reload",
                    click: () => contents.reload(),
                });
                electron_1.Menu.buildFromTemplate(template).popup({ window: win });
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
