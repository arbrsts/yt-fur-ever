import { app, BrowserWindow, inAppPurchase, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ChildProcess, exec } from "child_process";
import { spawn } from "child_process";

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
import util from "util";
const execAsync = util.promisify(exec);

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

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

const db = require("better-sqlite3")("./furever.db");
const row = db.prepare("SELECT * FROM favorites").get();

const getFavorites = () => {
  const rows = db.prepare("SELECT * FROM favorites").all();
  return rows;
};

ipcMain.handle("favorites-get", (event, command) => {
  return getFavorites();
});

ipcMain.handle("favorites-remove", (event, command) => {
  const stmt = db.prepare("DELETE FROM favorites WHERE id = ?");

  stmt.run(command);
});

ipcMain.handle("favorites-add", async (event, command) => {
  const sanitizedCommand = `.\\bin\\yt-dlp ${command} --skip-download --flat-playlist  --dump-single-json `;
  const test = await execAsync(sanitizedCommand);
  const output = JSON.parse(test.stdout);

  if (command) {
    const insertStmt = db.prepare(
      "INSERT INTO favorites (url, title) VALUES (?, ?)"
    );
    const result = insertStmt.run(command, output.title);

    // Get the inserted record using lastInsertRowid
    const getStmt = db.prepare("SELECT * FROM favorites WHERE rowid = ?");
    const insertedRow = getStmt.get(result.lastInsertRowid);

    return insertedRow;
  }
});

const getSetting = (key: string) => {
  const rows = db.prepare(`SELECT * FROM settings WHERE key='${key}'`).all();
  return rows[0].value;
};

ipcMain.handle("settings-get", async (event, command) => {
  return getSetting(command);
});

ipcMain.handle("choose-location", async () => {
  const { dialog } = require("electron");
  const { filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  console.log(filePaths);

  if (filePaths) {
    const stmt = db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value"
    );
    const info = stmt.run("savePath", filePaths[0]);
    console.log(info);

    return filePaths[0];
  }
});

class DownloadManager {
  public queue: {
    url: string;
  }[] = [];
  private currentDownload?: ChildProcess;
  public isProcessing = false; // Add this flag
  private onFinish: () => void;
  private onStdout: () => void;
  private onStderr: () => void;
  private onUpdate: () => void;

  constructor({ onFinish, onStdout, onStderr, onUpdate }) {
    this.onFinish = onFinish;
    this.onStdout = onStdout;
    this.onStderr = onStderr;
    this.onUpdate = onUpdate;
  }

  add(url: string) {
    this.queue.push({ url });

    this.onUpdate(this.queue);

    if (!this.isProcessing) {
      this.isProcessing = true;
      this.onFinish(this.isProcessing);
      this.processNext();
    }
  }

  processNext() {
    console.log("processing", this.queue);
    const downloadCommand = `.\\bin\\yt-dlp  ${
      this.queue[0].url
    } --embed-thumbnail -f bestaudio -x --audio-format mp3 --audio-quality 320k --embed-metadata -P ${getSetting(
      "savePath"
    )}`;

    const ytDlp = spawn(downloadCommand, [], { shell: true });
    this.currentDownload = ytDlp;

    const onStdout = this.onStdout;
    const onStderr = this.onStderr;

    if (onStdout) ytDlp.stdout.on("data", onStdout);
    if (onStderr) ytDlp.stderr.on("data", onStderr);

    // Add close handler
    ytDlp.on("close", (code) => {
      this.queue.shift();

      this.onUpdate(this.queue);
      this.currentDownload = undefined;
      if (this.queue.length > 0) {
        this.processNext(); // Process next in queue
      } else {
        this.isProcessing = false;
        this.onFinish(this.isProcessing);
      }
    });
  }

  cancel() {
    if (process.platform === "win32") {
      // Kill all known related processes
      const processesToKill = [
        "yt-dlp.exe",
        "ffmpeg.exe",
        "ffprobe.exe",
        "AtomicParsley.exe", // Used for embedding thumbnails
      ];

      processesToKill.forEach((processName) => {
        try {
          spawn("taskkill", ["/IM", processName, "/F"]);
        } catch (error) {
          console.error(`Failed to kill ${processName}:`, error);
        }
      });

      // Also kill by window title pattern as backup
      spawn("taskkill", ["/FI", "WINDOWTITLE eq *yt-dlp*", "/F"]);
      spawn("taskkill", ["/FI", "WINDOWTITLE eq *ffmpeg*", "/F"]);
    } else {
      // Unix systems
      ["yt-dlp", "ffmpeg", "ffprobe", "AtomicParsley"].forEach(
        (processName) => {
          try {
            spawn("pkill", ["-f", processName]);
          } catch (error) {
            console.error(`Failed to kill ${processName}:`, error);
          }
        }
      );
    }

    this.queue = [];
    this.currentDownload = undefined;

    this.onFinish(this.isProcessing);
    this.isProcessing = false;
  }
}

const downloadManager = new DownloadManager({
  onFinish: (isDownloading) => {
    win?.webContents.send("yt-dlp-status", isDownloading);
  },
  onStdout: (data) => {
    console.log(data.toString());
  },
  onUpdate: (queue) => {
    win?.webContents.send("yt-dlp-update", queue);
  },
});

ipcMain.handle("download-cancel", () => {
  console.log("cancelling");
  downloadManager.cancel();
});

ipcMain.handle("sync-collection", async (event, command) => {
  try {
    const favorites = await getFavorites();

    // Process favorites one at a time
    for (const favorite of favorites) {
      const sanitizedCommand = `.\\bin\\yt-dlp ${favorite.url} --flat-playlist --print id`;

      // Convert exec to Promise
      const execPromise = () => {
        return new Promise((resolve, reject) => {
          exec(sanitizedCommand, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
          });
        });
      };

      // Get playlist IDs
      const stdout = await execPromise();
      const playlist = stdout.split("\n");
      const savedVideos = await getYoutubeIds(getSetting("savePath"));
      const newVideos = playlist.filter((id) => !savedVideos.includes(id));

      // Process videos in this playlist one at a time
      for (const newVideoId of newVideos) {
        if (!newVideoId.length) {
          console.error("Invalid id: ", newVideoId);
          continue;
        }
        const url = `https://www.youtube.com/watch?v=${newVideoId}`;

        try {
          downloadManager.add(url);
        } catch (error) {
          console.error(`Failed to download ${newVideoId}:`, error);
        }
      }
    }

    return { success: true, data: downloadManager.queue };
  } catch (err) {
    console.error("Error during sync:", err);
    return { success: false, error: err.message };
  }
});

function getYoutubeIds(directory) {
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

/**
 * TODO: Handle with Redux
 */
ipcMain.handle("test", async () => {
  const savePath = getSetting("savePath");
  const ids = await getYoutubeIds(savePath);
  return ids;
});

// Redux test

ipcMain.on("increment", (event, amount) => {
  // Perform any main process logic here
  const result = amount + 1;
  // Send result back to renderer
  event.reply("increment-reply", result);
});

app.whenReady().then(createWindow);
