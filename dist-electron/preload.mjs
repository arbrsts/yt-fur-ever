"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  },
  runCommand: (command) => electron.ipcRenderer.invoke("run-command", command),
  onYtDlpOutput: (callback) => electron.ipcRenderer.on("yt-dlp-output", (event, data) => callback(data)),
  onYtDlpError: (callback) => electron.ipcRenderer.on("yt-dlp-error", (event, data) => callback(data)),
  removeYtDlpListeners: () => {
    electron.ipcRenderer.removeAllListeners("yt-dlp-output");
    electron.ipcRenderer.removeAllListeners("yt-dlp-error");
  }
  // You can expose other APTs you need here.
  // ...
});
