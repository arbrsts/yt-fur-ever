import { ipcRenderer, contextBridge } from 'electron'



// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  runCommand: (command: string) => ipcRenderer.invoke('run-command', command),
  onYtDlpOutput: (callback: (data: string) => void) =>
    ipcRenderer.on('yt-dlp-output', (event, data) => callback(data)),
  onYtDlpError: (callback: (data: string) => void) =>
    ipcRenderer.on('yt-dlp-error', (event, data) => callback(data)),
  removeYtDlpListeners: () => {
    ipcRenderer.removeAllListeners('yt-dlp-output');
    ipcRenderer.removeAllListeners('yt-dlp-error');
  }


  // You can expose other APTs you need here.
  // ...
})
