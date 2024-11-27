import { IpcMain } from "electron";
import { BaseIpcService } from "../BaseIPCService";
import { IPC_CHANNELS } from "../constants";
import { SettingsService } from "../settings/service";
import * as fs from "fs/promises";
import db from "../../db";

export class CollectionService extends BaseIpcService {
  private settingsService: SettingsService;

  constructor(ipcMain: IpcMain, settingsService: SettingsService) {
    super(ipcMain);
    this.settingsService = settingsService;
  }

  protected registerChannels(): void {
    this.handle<void, string[]>(IPC_CHANNELS.COLLECTION.GET, () => {
      return this.getCollection();
    });
  }

  protected registerDatabase(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        url VARCHAR(255),
        title VARCHAR(255),
        UNIQUE(id)
      );
    `);
  }

  async getCollection(): Promise<string[]> {
    const savePath = this.settingsService.getSetting("savePath");
    const ids = (await this.getYoutubeIds(savePath)) as string[];
    return ids;
  }

  private getYoutubeIds(directory) {
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
}
