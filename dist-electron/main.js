"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const node_module = require("node:module");
const node_url = require("node:url");
const path = require("path");
const fs = require("fs/promises");
const util = require("util");
const child_process = require("child_process");
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
const IPC_CHANNELS = {
  SETTINGS: {
    GET: "settings-get",
    SET: "settings-set"
  },
  FAVORITES: {
    GET: "favorites-get",
    ADD: "favorites-add",
    REMOVE: "favorites-remove"
  },
  DOWNLOAD: {
    CANCEL: "download-cancel",
    SYNC_COLLECTION: "sync-collection",
    // Events sent to renderer
    STATUS: "yt-dlp-status",
    UPDATE: "yt-dlp-update"
  },
  COLLECTION: {
    GET: "collection-get"
  }
  // Add other channel groups here
};
class BaseIpcService {
  constructor(ipcMain) {
    this.ipcMain = ipcMain;
    this.registerChannels();
  }
  // Utility method for handler registration
  handle(channel, handler) {
    this.ipcMain.handle(channel, async (_, params) => {
      try {
        return await handler(params);
      } catch (error) {
        console.error(`Error in handler ${channel}:`, error);
        throw error;
      }
    });
  }
}
class SettingsService extends BaseIpcService {
  constructor(db, ipcMain) {
    super(ipcMain);
    this.db = db;
  }
  registerChannels() {
    this.handle(
      IPC_CHANNELS.SETTINGS.GET,
      (params) => this.getSetting(params.key)
    );
    this.handle(
      IPC_CHANNELS.SETTINGS.SET,
      (params) => this.setSetting(params)
    );
  }
  getSetting(key) {
    const stmt = this.db.prepare("SELECT value FROM settings WHERE key = ?");
    const row = stmt.get(key);
    return (row == null ? void 0 : row.value) ?? null;
  }
  async setSetting(params) {
    const { key, value, type } = params;
    let finalValue = value ?? void 0;
    if (type === "path") {
      const result = await electron.dialog.showOpenDialog({
        properties: ["openDirectory"]
      });
      console.log(result);
      if (!result.canceled && result.filePaths.length > 0) {
        finalValue = result.filePaths[0];
      } else {
        return null;
      }
    }
    if (!finalValue) {
      return null;
    }
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value) 
      VALUES (?, ?) 
      ON CONFLICT (key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(key, finalValue);
    return finalValue;
  }
  // Easy to add more methods
  async getAllSettings() {
    const stmt = this.db.prepare("SELECT * FROM settings");
    return stmt.all();
  }
  async deleteSetting(key) {
    const stmt = this.db.prepare("DELETE FROM settings WHERE key = ?");
    return stmt.run(key);
  }
}
const execAsync$1 = util.promisify(child_process.exec);
class FavoritesService extends BaseIpcService {
  constructor(db, ipcMain) {
    super(ipcMain);
    this.db = db;
  }
  registerChannels() {
    this.handle(
      IPC_CHANNELS.FAVORITES.GET,
      () => this.getFavorites()
    );
    this.handle(
      IPC_CHANNELS.FAVORITES.REMOVE,
      (params) => this.removeFavorite(params)
    );
    this.handle(
      IPC_CHANNELS.FAVORITES.ADD,
      (params) => this.addFavorite(params)
    );
  }
  getFavorites() {
    const stmt = this.db.prepare("SELECT * FROM favorites");
    return stmt.all();
  }
  removeFavorite(id) {
    console.log("hi", id);
    const stmt = this.db.prepare("DELETE FROM favorites WHERE id = ?");
    stmt.run(id);
  }
  async addFavorite(url) {
    try {
      const sanitizedCommand = `${ytDlpPath} ${url} --skip-download --flat-playlist --dump-single-json`;
      const { stdout } = await execAsync$1(sanitizedCommand);
      const output = JSON.parse(stdout);
      const insertStmt = this.db.prepare(
        "INSERT INTO favorites (url, title) VALUES (?, ?)"
      );
      const result = insertStmt.run(url, output.title);
      const getStmt = this.db.prepare(
        "SELECT * FROM favorites WHERE rowid = ?"
      );
      return getStmt.get(result.lastInsertRowid);
    } catch (error) {
      console.error("Error adding favorite:", error);
      return null;
    }
  }
}
class DownloadManager {
  constructor({ onFinish, onStdout, onStderr, onUpdate, settings }) {
    __publicField(this, "queue", []);
    __publicField(this, "currentDownload");
    __publicField(this, "isProcessing", false);
    // Add this flag
    __publicField(this, "onFinish");
    __publicField(this, "onStdout");
    __publicField(this, "onStderr");
    __publicField(this, "onUpdate");
    __publicField(this, "settings");
    this.onFinish = onFinish;
    this.onStdout = onStdout;
    this.onStderr = onStderr;
    this.onUpdate = onUpdate;
    this.settings = settings;
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
    const downloadCommand = `${ytDlpPath}  ${this.queue[0].url} --embed-thumbnail -f bestaudio -x --audio-format mp3 --audio-quality 320k --embed-metadata -P ${this.settings.getSetting(
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
const execAsync = util.promisify(child_process.exec);
class DownloadService extends BaseIpcService {
  constructor(ipcMain, favoritesService, settingsService, rendererWindow) {
    super(ipcMain);
    __publicField(this, "downloadManager");
    __publicField(this, "rendererWindow");
    this.favoritesService = favoritesService;
    this.settingsService = settingsService;
    this.rendererWindow = rendererWindow;
    this.settingsService = settingsService;
    this.downloadManager = new DownloadManager({
      onFinish: (isDownloading) => {
        var _a;
        (_a = this.rendererWindow) == null ? void 0 : _a.webContents.send("yt-dlp-status", isDownloading);
      },
      onStdout: (data) => {
        console.log(data.toString());
      },
      onUpdate: (queue) => {
        var _a;
        console.log("updating", this.rendererWindow);
        (_a = this.rendererWindow) == null ? void 0 : _a.webContents.send("yt-dlp-update", queue);
      },
      settings: this.settingsService
    });
  }
  registerChannels() {
    this.handle(
      IPC_CHANNELS.DOWNLOAD.CANCEL,
      () => this.cancelDownload()
    );
    this.handle(
      IPC_CHANNELS.DOWNLOAD.SYNC_COLLECTION,
      () => this.syncCollection()
    );
  }
  cancelDownload() {
    this.downloadManager.cancel();
  }
  async syncCollection() {
    try {
      for (const favorite of this.favoritesService.getFavorites()) {
        await this.processPlaylist(favorite);
      }
      return {
        success: true,
        data: this.downloadManager.queue
      };
    } catch (error) {
      console.error("Error during sync:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  async processPlaylist(favorite) {
    const sanitizedCommand = `${ytDlpPath} ${favorite.url} --flat-playlist --print id`;
    try {
      const { stdout } = await execAsync(sanitizedCommand);
      const playlist = stdout.split("\n");
      const savedVideos = await getYoutubeIds(
        this.downloadManager.settings.getSetting("savePath")
      );
      const newVideos = playlist.filter(
        (id) => id.length && !savedVideos.includes(id)
      );
      for (const videoId of newVideos) {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        try {
          this.downloadManager.add(url);
        } catch (error) {
          console.error(`Failed to queue ${videoId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to process playlist ${favorite.url}:`, error);
      throw error;
    }
  }
  setRendererWindow(window) {
    this.rendererWindow = window;
  }
  getQueue() {
    return this.downloadManager.queue;
  }
  isDownloading() {
    return this.downloadManager.isDownloading;
  }
}
class CollectionService extends BaseIpcService {
  constructor(ipcMain, settingsService) {
    super(ipcMain);
    __publicField(this, "settingsService");
    this.settingsService = settingsService;
  }
  registerChannels() {
    this.handle(IPC_CHANNELS.COLLECTION.GET, () => {
      return this.getCollection();
    });
  }
  async getCollection() {
    const savePath = this.settingsService.getSetting("savePath");
    const ids = await this.getYoutubeIds(savePath);
    return ids;
  }
  getYoutubeIds(directory) {
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
}
const require$1 = node_module.createRequire(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("main.js", document.baseURI).href);
const __dirname$1 = path__namespace.dirname(node_url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("main.js", document.baseURI).href));
require$1("electron");
process.env.APP_ROOT = path__namespace.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path__namespace.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path__namespace.join(process.env.APP_ROOT, "dist");
const ytDlpPath = process.env.NODE_ENV === "development" ? path__namespace.join(process.cwd(), "bin", "yt-dlp") : path__namespace.join(process.resourcesPath, "bin", "yt-dlp");
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
  const db = require$1("better-sqlite3")("./furever.db");
  const settingsService = new SettingsService(db, electron.ipcMain);
  const favoritesService = new FavoritesService(db, electron.ipcMain);
  new DownloadService(
    electron.ipcMain,
    favoritesService,
    settingsService,
    win
    // Pass the renderer window
  );
  new CollectionService(electron.ipcMain, settingsService);
  electron.ipcMain.handle("test", async () => {
    const savePath = settingsService.getSetting("savePath");
    const ids = await getYoutubeIds(savePath);
    return ids;
  });
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
electron.app.whenReady().then(createWindow);
exports.MAIN_DIST = MAIN_DIST;
exports.RENDERER_DIST = RENDERER_DIST;
exports.VITE_DEV_SERVER_URL = VITE_DEV_SERVER_URL;
exports.getYoutubeIds = getYoutubeIds;
exports.ytDlpPath = ytDlpPath;
