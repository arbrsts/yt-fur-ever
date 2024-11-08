"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const node_module = require("node:module");
const node_url = require("node:url");
const child_process = require("child_process");
const path = require("path");
const fs = require("fs/promises");
const util = require("util");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const require$1 = node_module.createRequire(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("main.js", document.baseURI).href);
const __dirname$1 = path__namespace.dirname(node_url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("main.js", document.baseURI).href));
require$1("electron");
process.env.APP_ROOT = path__namespace.join(__dirname$1, "..");
const execAsync = util.promisify(child_process.exec);
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path__namespace.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path__namespace.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path__namespace.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new electron.BrowserWindow({
    icon: path__namespace.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path__namespace.join(__dirname$1, "preload.js")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path__namespace.join(RENDERER_DIST, "index.html"));
  }
}
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
    win = null;
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
const db = require$1("better-sqlite3")("./furever.db");
db.prepare("SELECT * FROM favorites").get();
const getFavorites = () => {
  const rows = db.prepare("SELECT * FROM favorites").all();
  return rows;
};
electron.ipcMain.handle("favorites-get", (event, command) => {
  return getFavorites();
});
electron.ipcMain.handle("favorites-remove", (event, command) => {
  const stmt = db.prepare("DELETE FROM favorites WHERE id = ?");
  stmt.run(command);
});
electron.ipcMain.handle("favorites-add", async (event, command) => {
  const sanitizedCommand = `.\\bin\\yt-dlp ${command} --skip-download --flat-playlist  --dump-single-json `;
  const test = await execAsync(sanitizedCommand);
  const output = JSON.parse(test.stdout);
  if (command) {
    const insertStmt = db.prepare(
      "INSERT INTO favorites (url, title) VALUES (?, ?)"
    );
    const result = insertStmt.run(command, output.title);
    const getStmt = db.prepare("SELECT * FROM favorites WHERE rowid = ?");
    const insertedRow = getStmt.get(result.lastInsertRowid);
    return insertedRow;
  }
});
const getSetting = (key) => {
  const rows = db.prepare(`SELECT * FROM settings WHERE key='${key}'`).all();
  return rows[0].value;
};
electron.ipcMain.handle("settings-get", async (event, command) => {
  return getSetting(command);
});
electron.ipcMain.handle("choose-location", async () => {
  const { dialog } = require$1("electron");
  const { filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"]
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
  constructor({ onFinish, onStdout, onStderr, onUpdate }) {
    __publicField(this, "queue", []);
    __publicField(this, "currentDownload");
    __publicField(this, "isProcessing", false);
    // Add this flag
    __publicField(this, "onFinish");
    __publicField(this, "onStdout");
    __publicField(this, "onStderr");
    __publicField(this, "onUpdate");
    this.onFinish = onFinish;
    this.onStdout = onStdout;
    this.onStderr = onStderr;
    this.onUpdate = onUpdate;
  }
  add(url) {
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
    const downloadCommand = `.\\bin\\yt-dlp  ${this.queue[0].url} --embed-thumbnail -f bestaudio -x --audio-format mp3 --audio-quality 320k --embed-metadata -P ${getSetting(
      "savePath"
    )}`;
    const ytDlp = child_process.spawn(downloadCommand, [], { shell: true });
    this.currentDownload = ytDlp;
    const onStdout = this.onStdout;
    const onStderr = this.onStderr;
    if (onStdout) ytDlp.stdout.on("data", onStdout);
    if (onStderr) ytDlp.stderr.on("data", onStderr);
    ytDlp.on("close", (code) => {
      this.queue.shift();
      this.onUpdate(this.queue);
      this.currentDownload = void 0;
      if (this.queue.length > 0) {
        this.processNext();
      } else {
        this.isProcessing = false;
        this.onFinish(this.isProcessing);
      }
    });
  }
  cancel() {
    if (process.platform === "win32") {
      const processesToKill = [
        "yt-dlp.exe",
        "ffmpeg.exe",
        "ffprobe.exe",
        "AtomicParsley.exe"
        // Used for embedding thumbnails
      ];
      processesToKill.forEach((processName) => {
        try {
          child_process.spawn("taskkill", ["/IM", processName, "/F"]);
        } catch (error) {
          console.error(`Failed to kill ${processName}:`, error);
        }
      });
      child_process.spawn("taskkill", ["/FI", "WINDOWTITLE eq *yt-dlp*", "/F"]);
      child_process.spawn("taskkill", ["/FI", "WINDOWTITLE eq *ffmpeg*", "/F"]);
    } else {
      ["yt-dlp", "ffmpeg", "ffprobe", "AtomicParsley"].forEach(
        (processName) => {
          try {
            child_process.spawn("pkill", ["-f", processName]);
          } catch (error) {
            console.error(`Failed to kill ${processName}:`, error);
          }
        }
      );
    }
    this.queue = [];
    this.currentDownload = void 0;
    this.onFinish(this.isProcessing);
    this.isProcessing = false;
  }
}
const downloadManager = new DownloadManager({
  onFinish: (isDownloading) => {
    win == null ? void 0 : win.webContents.send("yt-dlp-status", isDownloading);
  },
  onStdout: (data) => {
    console.log(data.toString());
  },
  onUpdate: (queue) => {
    win == null ? void 0 : win.webContents.send("yt-dlp-update", queue);
  }
});
electron.ipcMain.handle("download-cancel", () => {
  console.log("cancelling");
  downloadManager.cancel();
});
electron.ipcMain.handle("sync-collection", async (event, command) => {
  try {
    const favorites = await getFavorites();
    for (const favorite of favorites) {
      const sanitizedCommand = `.\\bin\\yt-dlp ${favorite.url} --flat-playlist --print id`;
      const execPromise = () => {
        return new Promise((resolve, reject) => {
          child_process.exec(sanitizedCommand, (error, stdout2, stderr) => {
            if (error) reject(error);
            else resolve(stdout2);
          });
        });
      };
      const stdout = await execPromise();
      const playlist = stdout.split("\n");
      const savedVideos = await getYoutubeIds(getSetting("savePath"));
      const newVideos = playlist.filter((id) => !savedVideos.includes(id));
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
    fs__namespace.readdir(directory, (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      const youtubeIds = files.filter((file) => file.endsWith(".mp3")).map((file) => {
        const match = file.match(/\[([a-zA-Z0-9_-]{11})\]\.mp3$/);
        return match ? match[1] : null;
      }).filter((id) => id !== null);
      resolve(youtubeIds);
    });
  });
}
electron.ipcMain.handle("test", async () => {
  const savePath = getSetting("savePath");
  const ids = await getYoutubeIds(savePath);
  return ids;
});
electron.ipcMain.on("increment", (event, amount) => {
  const result = amount + 1;
  event.reply("increment-reply", result);
});
electron.app.whenReady().then(createWindow);
exports.MAIN_DIST = MAIN_DIST;
exports.RENDERER_DIST = RENDERER_DIST;
exports.VITE_DEV_SERVER_URL = VITE_DEV_SERVER_URL;
