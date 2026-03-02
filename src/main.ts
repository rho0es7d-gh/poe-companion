import { app, BrowserWindow, session, ipcMain } from "electron";
import path from "path";

// A. Ad-Blocking List
// Common ad/tracker domains found on Fandom, PoE Wiki, etc.
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
  // Intercept window.open() calls from any <webview>
  app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() === "webview") {
      // 1. Handle window.open() / target="_blank"
      contents.setWindowOpenHandler(({ url }) => {
        // Send the URL to the renderer to open as a tab
        win.webContents.send("open-in-new-tab", url);
        return { action: "deny" };
      });

      // 2. Handle middle-clicks or other navigation types if necessary
      contents.on('will-navigate', (event, url) => {
        // We generally allow navigation within the webview, 
        // but if you wanted to force external links to system browser, do it here.
      });
    }
  });
}

app.whenReady().then(() => {
  // A. Register Ad-Blocker
  session.defaultSession.webRequest.onBeforeRequest(adFilter, (details, callback) => {
    callback({ cancel: true }); // Block ads
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