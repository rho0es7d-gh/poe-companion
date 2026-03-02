import { app, BrowserWindow, session, ipcMain, Menu, clipboard } from "electron";
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

app.whenReady().then(() => {
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

  // D. Context Menu Handler (Right Click)
  ipcMain.on("show-context-menu", (event, params) => {
    const template: Electron.MenuItemConstructorOptions[] = [];

    // 1. Link Actions
    if (params.linkURL) {
      template.push({
        label: "Copy Link Address",
        click: () => clipboard.writeText(params.linkURL),
      });
    }

    // 2. Image Actions
    if (params.mediaType === "image" && params.srcURL) {
      template.push({
        label: "Copy Image Address",
        click: () => clipboard.writeText(params.srcURL),
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
      click: () => clipboard.writeText(params.pageURL),
    });

    // 5. Navigation & DevTools
    template.push(
      { type: "separator" },
      { label: "Back", enabled: params.editFlags.canGoBack, click: () => event.sender.goBack() },
      { label: "Forward", enabled: params.editFlags.canGoForward, click: () => event.sender.goForward() },
      { label: "Reload", click: () => event.sender.reload() }
    );

    const menu = Menu.buildFromTemplate(template);
    
    // We need to show the menu attached to the window that sent the event
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      menu.popup({ window: win });
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});