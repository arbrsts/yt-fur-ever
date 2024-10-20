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

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer
}


export interface ElectronAPI {
  runCommand: (command: string) => Promise<void>;
  onYtDlpOutput: (callback: (data: string) => void) => void;
  onYtDlpError: (callback: (data: string) => void) => void;
  removeYtDlpListeners: () => void;
}

declare global {
  interface Window {
    ipcRenderer: ElectronAPI & import('electron').IpcRenderer;
  }
}