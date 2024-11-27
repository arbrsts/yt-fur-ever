// src/services/download/service.ts
import { IpcMain } from "electron";
import { BaseIpcService } from "../BaseIPCService";
import { IPC_CHANNELS } from "../constants";
import { exec } from "child_process";
import { promisify } from "util";
import { DownloadManagerConfig, SyncResult } from "./types";
import { DownloadManager } from "./DownloadManager";
import { getYoutubeIds, ytDlpPath } from "../../main";
import { Favorite } from "../favorites/types";
import { FavoritesService } from "../favorites/service";
import { SettingsService } from "../settings/service";

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
        this.rendererWindow?.webContents.send("yt-dlp-status", isDownloading);
      },
      onStdout: (data) => {
        console.log(data.toString());
      },
      onUpdate: (queue) => {
        console.log("updating", this.rendererWindow);
        this.rendererWindow?.webContents.send("yt-dlp-update", queue);
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

  protected registerDatabase(): void {}

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
    const sanitizedCommand = `${ytDlpPath} ${favorite.url} --flat-playlist --print id`;

    try {
      // Get playlist IDs
      const { stdout } = await execAsync(sanitizedCommand);
      const playlist = stdout.split("\n");
      const savedVideos = await getYoutubeIds(
        this.downloadManager.settings.getSetting("savePath")
      );

      // Filter for new videos
      const newVideos = playlist.filter(
        (id) => id.length && !savedVideos.includes(id)
      );

      // Queue new videos for download
      for (const videoId of newVideos) {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        try {
          this.downloadManager.add(url);
        } catch (error) {
          console.error(`Failed to queue ${videoId}:`, error);
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
