/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

interface ElectronAPI {
  on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => void;
  off: (channel: string, ...args: any[]) => void;
  send: (channel: string, ...args: any[]) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  runCommand: (command: string) => Promise<any>;
  onYtDlpOutput: (callback: (data: string) => void) => void;
  onYtDlpError: (callback: (data: string) => void) => void;
  removeYtDlpListeners: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}