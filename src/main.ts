import { app, BrowserWindow, session, ipcMain } from "electron";
import path from "path";

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
      webviewTag: true, // enable <webview> tag
    },
  });

  win.loadFile(path.join(__dirname, "index.html"));

  // Block new BrowserWindows from the main window itself
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // Intercept window.open() calls from any <webview> inside the app.
  // When a webview tries to open a new window, deny it and instead
  // tell the renderer to open it as a new tab.
  app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() === "webview") {
      contents.setWindowOpenHandler(({ url }) => {
        // Send the URL to the renderer so it opens as a new tab
        win.webContents.send("open-in-new-tab", url);
        return { action: "deny" };
      });
    }
  });
}

app.whenReady().then(() => {
  // Allow all content in webviews (so every site loads)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };

    // Remove headers that would block embedding
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