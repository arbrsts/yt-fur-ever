import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import * as path from "path";
import * as fs from "fs/promises";

// Preload (Isolated World)

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { contextBridge, ipcRenderer } = require("electron");

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");
import { SettingsService } from "./services/settings/service";
import { FavoritesService } from "./services/favorites/service";
import { DownloadService } from "./services/download/service";
import { CollectionService } from "./services/collection/service";
import db from "./db";

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

export const ytDlpPath =
  process.env.NODE_ENV === "development"
    ? path.join(process.cwd(), "bin", "yt-dlp")
    : path.join(process.resourcesPath, "bin", "yt-dlp");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  const settingsService = new SettingsService(db, ipcMain);
  const favoritesService = new FavoritesService(db, ipcMain);
  // Usage in main.ts
  const downloadService = new DownloadService(
    ipcMain,
    favoritesService,
    settingsService,
    win // Pass the renderer window
  );
  const collectionService = new CollectionService(ipcMain, settingsService);

  /**
   * TODO: Handle with Redux
   * This is the downloaded list
   */
  ipcMain.handle("test", async () => {
    const savePath = settingsService.getSetting("savePath");
    const ids = await getYoutubeIds(savePath);
    return ids;
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

/*
  Downloaded
*/

export function getYoutubeIds(directory) {
  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      const youtubeIds = files
        .filter((file) => file.endsWith(".mp3"))
        .map((file) => {
          const match = file.match(/\[([a-zA-Z0-9_-]{11})\]\.mp3$/);
          return match ? match[1] : null;
        })
        .filter((id) => id !== null);

      resolve(youtubeIds);
    });
  });
}

app.whenReady().then(createWindow);
