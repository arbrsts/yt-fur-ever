import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { exec } from "child_process";
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
      preload: path.join(__dirname, "preload.mjs"),
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
console.log(row);

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
    const stmt = db.prepare("INSERT INTO favorites (url, title) VALUES (?, ?)");
    const info = stmt.run(command, output.title);

    console.log("command", info, output.title);
  }
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
      const savedVideos = await getYoutubeIds(`.\\temp`);
      const newVideos = playlist.filter((id) => !savedVideos.includes(id));

      // Process videos in this playlist one at a time
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
            )
              .then(resolve)
              .catch(reject);
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

ipcMain.handle("test", async () => {
  const ids = await getYoutubeIds("./temp");
  console.log(ids);
  console.log("hi");
  return ids;
});

const downloadMusic = (
  url: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onStdout?: (data: any) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onStderr?: (data: any) => void
) => {
  const downloadCommand = `.\\bin\\yt-dlp  ${url} --embed-thumbnail -f bestaudio -x --audio-format mp3 --audio-quality 320k --embed-metadata -P .\\temp`;

  const ytDlp = spawn(downloadCommand, [], { shell: true });

  if (onStdout) ytDlp.stdout.on("data", onStdout);
  if (onStderr) ytDlp.stderr.on("data", onStderr);

  return new Promise<void>((resolve, reject) => {
    ytDlp.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`yt-dlp process exited with code ${code}`));
      }
    });
  });
};

app.whenReady().then(createWindow);
