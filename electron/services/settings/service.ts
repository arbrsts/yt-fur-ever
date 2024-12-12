// src/ipc/settings/handler.ts
import { IpcMain, dialog } from "electron";
import type { Database } from "better-sqlite3";
import { IPC_CHANNELS } from "@yt-fur-ever/ipc";
import type { SettingsGetParams, SettingsSetParams } from "./types";
import { BaseIpcService } from "../BaseIPCService";
import db from "../../db";

export class SettingsService extends BaseIpcService {
  constructor(private readonly db: Database, ipcMain: IpcMain) {
    super(ipcMain);
  }

  protected registerChannels(): void {
    this.handle(IPC_CHANNELS.SETTINGS.GET, (params: SettingsGetParams) =>
      this.getSetting(params.key)
    );

    this.handle(IPC_CHANNELS.SETTINGS.SET, (params: SettingsSetParams) =>
      this.setSetting(params)
    );
  }

  protected registerDatabase(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(255) NOT NULL,
      value VARCHAR(255) NOT NULL,
      PRIMARY KEY (key)
      );`
    );
  }

  public getSetting(key: string) {
    const stmt = this.db.prepare("SELECT value FROM settings WHERE key = ?");
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private async setSetting(params: SettingsSetParams) {
    const { key, value, type } = params;
    let finalValue = value ?? undefined;

    if (type === "path") {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });

      console.log(result);

      if (!result.canceled && result.filePaths.length > 0) {
        finalValue = result.filePaths[0];
      } else {
        return null;
      }
    }

    if (!finalValue) {
      return null;
    }

    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value) 
      VALUES (?, ?) 
      ON CONFLICT (key) DO UPDATE SET value = excluded.value
    `);

    stmt.run(key, finalValue);
    return finalValue;
  }

  // Easy to add more methods
  async getAllSettings() {
    const stmt = this.db.prepare("SELECT * FROM settings");
    return stmt.all();
  }

  async deleteSetting(key: string) {
    const stmt = this.db.prepare("DELETE FROM settings WHERE key = ?");
    return stmt.run(key);
  }
}

// src/main.ts
export function initializeIpc(db: Database, ipcMain: IpcMain) {
  new SettingsService(db, ipcMain);
  // Add other handlers
}
