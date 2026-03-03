import { app, BrowserWindow, session, Menu, clipboard, nativeTheme } from "electron";
import path from "path";

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

function createWindow(): void {
  const win = new BrowserWindow({
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
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  win.loadFile(path.join(__dirname, "index.html"));

  // Block new native windows from the main app container
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // B. Fixing "Target=_blank" Links
  app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() === "webview") {
      // New window → open as tab in renderer
      contents.setWindowOpenHandler(({ url }) => {
        win.webContents.send("open-in-new-tab", url);
        return { action: "deny" };
      });

      // Right-click context menu — build menu here so Back/Forward/Reload
      // correctly target THIS webview's webContents, not the main window
      contents.on("context-menu", (_e, params) => {
        const template: Electron.MenuItemConstructorOptions[] = [];

        if (params.linkURL) {
          template.push({
            label: "Open Link in New Tab",
            click: () => win.webContents.send("open-in-new-tab", params.linkURL),
          });
          template.push({
            label: "Copy Link Address",
            click: () => clipboard.writeText(params.linkURL),
          });
        }

        if (params.mediaType === "image" && params.srcURL) {
          template.push({
            label: "Copy Image Address",
            click: () => clipboard.writeText(params.srcURL),
          });
        }

        if (params.selectionText) {
          template.push({ role: "copy" as const });
        }

        if (template.length > 0) template.push({ type: "separator" as const });

        template.push({
          label: "Copy Page URL",
          click: () => clipboard.writeText(params.pageURL),
        });

        template.push({ type: "separator" as const });

        // These now correctly call contents (the webview), not event.sender (the shell)
        template.push(
          {
            label: "Back",
            enabled: contents.canGoBack(),
            click: () => contents.goBack(),
          },
          {
            label: "Forward",
            enabled: contents.canGoForward(),
            click: () => contents.goForward(),
          },
          {
            label: "Reload",
            click: () => contents.reload(),
          }
        );

        Menu.buildFromTemplate(template).popup({ window: win });
      });
    }
  });
}

app.whenReady().then(() => {
  // NEW: Force the entire app (and webviews) into Dark Mode
  nativeTheme.themeSource = "dark";

  // A. Register Ad-Blocker
  session.defaultSession.webRequest.onBeforeRequest(adFilter, (details, callback) => {
    callback({ cancel: true }); 
  });

  // Allow embedding by stripping headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers["x-frame-options"];
    delete headers["X-Frame-Options"];
    delete headers["content-security-policy"];
    delete headers["Content-Security-Policy"];
    callback({ responseHeaders: headers });
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});