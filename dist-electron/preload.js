"use strict";
const electron = require("electron");
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
electron.contextBridge.exposeInMainWorld("electron", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(
      channel,
      (event, ...args2) => listener(event, ...args2)
    );
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
  once(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.once(
      channel,
      (event, ...args2) => listener(event, ...args2)
    );
  },
  settings: {
    get: (params) => electron.ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.GET, params),
    set: (params) => electron.ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.SET, params)
  },
  runCommand: (command) => electron.ipcRenderer.invoke("run-command", command),
  onYtDlpOutput: (callback) => electron.ipcRenderer.on("yt-dlp-output", (event, data) => callback(data)),
  onYtDlpError: (callback) => electron.ipcRenderer.on("yt-dlp-error", (event, data) => callback(data)),
  removeYtDlpListeners: () => {
    electron.ipcRenderer.removeAllListeners("yt-dlp-output");
    electron.ipcRenderer.removeAllListeners("yt-dlp-error");
    electron.ipcRenderer.removeAllListeners("yt-dlp-status");
    electron.ipcRenderer.removeAllListeners("yt-dlp-update");
  },
  receive: (channel, func) => {
    electron.ipcRenderer.on(channel, (_, ...args) => func(...args));
  }
  // You can expose other APTs you need here.
  // ...
});
