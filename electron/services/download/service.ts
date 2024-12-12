// src/services/download/service.ts
import { IpcMain } from "electron";
import { BaseIpcService } from "../BaseIPCService";
import { IPC_CHANNELS } from "@yt-fur-ever/ipc";
import { exec } from "child_process";
import { promisify } from "util";
import { DownloadManagerConfig, SyncResult } from "./types";
import { DownloadManager } from "./DownloadManager";
import { getYoutubeIds, ytDlpPath } from "../../main";
import { Favorite } from "../favorites/types";
import { FavoritesService } from "../favorites/service";
import { SettingsService } from "../settings/service";
import db from "../../db";

const execAsync = promisify(exec);

export class DownloadService extends BaseIpcService {
  private downloadManager: DownloadManager;
  private rendererWindow?: Electron.BrowserWindow;

  constructor(
    ipcMain: IpcMain,
    private readonly favoritesService: FavoritesService,
    private readonly settingsService: SettingsService,
    rendererWindow?: Electron.BrowserWindow | undefined
  ) {
    super(ipcMain);
    this.rendererWindow = rendererWindow;
    this.settingsService = settingsService;

    this.downloadManager = new DownloadManager({
      onFinish: (isDownloading) => {
        this.rendererWindow?.webContents.send(
          IPC_CHANNELS.DOWNLOAD.STATUS_UPDATE,
          isDownloading
        );
      },
      onStdout: (data) => {
        console.log(data.toString());
      },
      onQueueUpdate: (queue) => {
        console.log("updating", queue);
        // Send update to frontend
        this.rendererWindow?.webContents.send(
          IPC_CHANNELS.DOWNLOAD.QUEUE_UPDATE,
          queue
        );
      },
      onCurrentDownloadUpdate: (currentDownload) => {
        // Persist update
        if (currentDownload?.queueItem) {
          const stmt = db.prepare(
            "INSERT INTO download (display_id, downloaded) VALUES (?, ?) ON CONFLICT(display_id) DO UPDATE SET downloaded = excluded.downloaded;"
          );
          stmt.run(
            currentDownload.queueItem.url,
            currentDownload.state == "SUCCESS" ? 1 : 0
          );

          const { process, ...rest } = currentDownload;
          const serialisableCurrentDownload = {
            ...rest,
            pid: process?.pid,
          };

          this.rendererWindow?.webContents.send(
            IPC_CHANNELS.DOWNLOAD.CURRENT_DOWNLOAD_UPDATE,
            serialisableCurrentDownload
          );
        }
      },

      settings: this.settingsService,
    });
  }

  protected registerChannels(): void {
    this.handle<void, void>(IPC_CHANNELS.DOWNLOAD.CANCEL, () =>
      this.cancelDownload()
    );

    this.handle<void, SyncResult>(IPC_CHANNELS.DOWNLOAD.SYNC_COLLECTION, () =>
      this.syncCollection()
    );
  }

  protected registerDatabase(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS download (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      downloaded BOOLEAN,
      display_id VARCHAR(255) NULL UNIQUE,
      UNIQUE(id)
      ); 
    `);
  }

  private cancelDownload(): void {
    this.downloadManager.cancel();
  }

  private async syncCollection(): Promise<SyncResult> {
    try {
      // Process favorites one at a time
      for (const favorite of this.favoritesService.getFavorites()) {
        await this.processPlaylist(favorite);
      }

      return {
        success: true,
        data: this.downloadManager.queue,
      };
    } catch (error) {
      console.error("Error during sync:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async processPlaylist(favorite: Favorite): Promise<void> {
    const sanitizedCommand = `${ytDlpPath} ${favorite.display_id} --flat-playlist --print id`;

    try {
      // Get playlist IDs
      const { stdout } = await execAsync(sanitizedCommand);
      // Remove empty strings
      const playlist = stdout.split("\n").filter(Boolean);

      // const savedVideos = await getYoutubeIds(
      //   this.downloadManager.settings.getSetting("savePath")
      // );

      // // Filter for new videos
      // const newVideos = playlist.filter(
      //   (id) => id.length && !savedVideos.includes(id)
      // );

      // Queue new videos for download
      for (const url of playlist) {
        try {
          this.downloadManager.add(url);
        } catch (error) {
          console.error(`Failed to queue ${url}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to process playlist ${favorite.url}:`, error);
      throw error;
    }
  }

  public setRendererWindow(window: Electron.BrowserWindow): void {
    this.rendererWindow = window;
  }

  public getQueue(): string[] {
    return this.downloadManager.queue;
  }

  public isDownloading(): boolean {
    return this.downloadManager.isDownloading;
  }
}
