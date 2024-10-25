import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { exec, spawn } from "child_process";
import * as path from "path";
import * as fs from "fs/promises";
const require2 = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
require2("electron");
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
const getFavorites = async () => {
  const data = await fs.readFile(".\\temp\\favorite.txt", "utf8");
  const favorites = data.split("\n");
  return favorites;
};
ipcMain.handle("favorites-get", () => {
  return getFavorites();
});
ipcMain.handle("sync-collection", async (event, command) => {
  try {
    const favorites = await getFavorites();
    await Promise.all(
      favorites.map(async (id) => {
        const sanitizedCommand = `.\\bin\\yt-dlp ${id} --flat-playlist --print id`;
        const execPromise = () => {
          return new Promise((resolve, reject) => {
            exec(sanitizedCommand, (error, stdout2, stderr) => {
              if (error) reject(error);
              else resolve(stdout2);
            });
          });
        };
        const stdout = await execPromise();
        const playlist = stdout.split("\n");
        const savedVideos = await getYoutubeIds(`.\\temp`);
        const newVideos = playlist.filter((id2) => !savedVideos.includes(id2));
        const downloadPromises = newVideos.map(async (newVideoId) => {
          if (!newVideoId.length) {
            console.error("Invalid id: ", newVideoId);
            return;
          }
          return new Promise((resolve, reject) => {
            downloadMusic(
              `https://www.youtube.com/watch?v=${newVideoId}`,
              (data) => {
                event.sender.send("yt-dlp-output", data.toString());
              }
            ).then(resolve).catch(reject);
          });
        });
        await Promise.all(downloadPromises);
        console.log("new", newVideos);
      })
    );
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
      const youtubeIds = files.filter((file) => file.endsWith(".mp3")).map((file) => {
        const match = file.match(/\[([a-zA-Z0-9_-]{11})\]\.mp3$/);
        return match ? match[1] : null;
      }).filter((id) => id !== null);
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
const downloadMusic = (url, onStdout, onStderr) => {
  const downloadCommand = `.\\bin\\yt-dlp  ${url} --embed-thumbnail -f bestaudio -x --audio-format mp3 --audio-quality 320k --embed-metadata -P .\\temp`;
  const ytDlp = spawn(downloadCommand, [], { shell: true });
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
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
