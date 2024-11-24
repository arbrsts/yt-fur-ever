// src/services/download/types.ts
export interface DownloadManagerConfig {
  onFinish: (isDownloading: boolean) => void;
  onStdout: (data: Buffer) => void;
  onUpdate: (queue: string[]) => void;
  settings: any; // Replace with your settings type
}

export interface SyncResult {
  success: boolean;
  data?: string[];
  error?: string;
}
