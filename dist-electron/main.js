"use strict";
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
      preload: path__namespace.join(__dirname$1, "preload.mjs")
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
const row = db.prepare("SELECT * FROM favorites").get();
console.log(row);
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
    const stmt = db.prepare("INSERT INTO favorites (url, title) VALUES (?, ?)");
    const info = stmt.run(command, output.title);
    console.log("command", info, output.title);
  }
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
      const savedVideos = await getYoutubeIds(`.\\temp`);
      const newVideos = playlist.filter((id) => !savedVideos.includes(id));
      for (const newVideoId of newVideos) {
        if (!newVideoId.length) {
          console.error("Invalid id: ", newVideoId);
          continue;
        }
        try {
          await new Promise((resolve, reject) => {
            downloadMusic(
              `https://www.youtube.com/watch?v=${newVideoId}`,
              (data) => {
                event.sender.send("yt-dlp-output", data.toString());
              }
            ).then(resolve).catch(reject);
          });
        } catch (error) {
          console.error(`Failed to download ${newVideoId}:`, error);
        }
      }
      console.log("new", newVideos);
    }
    console.log("All downloads completed");
    return { success: true };
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
  const ids = await getYoutubeIds("./temp");
  console.log(ids);
  console.log("hi");
  return ids;
});
const downloadMusic = (url, onStdout, onStderr) => {
  const downloadCommand = `.\\bin\\yt-dlp  ${url} --embed-thumbnail -f bestaudio -x --audio-format mp3 --audio-quality 320k --embed-metadata -P .\\temp`;
  const ytDlp = child_process.spawn(downloadCommand, [], { shell: true });
  if (onStdout) ytDlp.stdout.on("data", onStdout);
  return new Promise((resolve, reject) => {
    ytDlp.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`yt-dlp process exited with code ${code}`));
      }
    });
  });
};
electron.app.whenReady().then(createWindow);
exports.MAIN_DIST = MAIN_DIST;
exports.RENDERER_DIST = RENDERER_DIST;
exports.VITE_DEV_SERVER_URL = VITE_DEV_SERVER_URL;
