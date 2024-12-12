import { IpcMain } from "electron";
import { Database } from "better-sqlite3";
import { BaseIpcService } from "../BaseIPCService";
import util from "util";
import { exec } from "child_process";
import { IPC_CHANNELS } from "@yt-fur-ever/ipc";
import { AddFavoriteParams, Favorite, RemoveFavoriteParams } from "./types";
import { ytDlpPath } from "../../main";
import db from "../../db";

const execAsync = util.promisify(exec);

export class FavoritesService extends BaseIpcService {
  constructor(private readonly db: Database, ipcMain: IpcMain) {
    super(ipcMain);
  }

  protected registerChannels(): void {
    this.handle<void, Favorite[]>(IPC_CHANNELS.FAVORITES.GET, () =>
      this.getFavorites()
    );

    this.handle<RemoveFavoriteParams, void>(
      IPC_CHANNELS.FAVORITES.REMOVE,
      (params) => this.removeFavorite(params)
    );

    this.handle<AddFavoriteParams, Favorite | null>(
      IPC_CHANNELS.FAVORITES.ADD,
      (params) => this.addFavorite(params)
    );
  }

  protected registerDatabase(): void {
    db.exec(
      "CREATE TABLE IF NOT EXISTS favorites (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, title VARCHAR(255), display_id VARCHAR(255) NULL, UNIQUE (id));"
    );
  }

  public getFavorites(): Favorite[] {
    const stmt = this.db.prepare(
      "SELECT f.*, d.downloaded FROM favorites f LEFT JOIN download d ON f.display_id= d.display_id;"
    );
    console.log(stmt.all());
    return stmt.all() as Favorite[];
  }

  private removeFavorite(id: number): void {
    console.log("hi", id);
    const stmt = this.db.prepare("DELETE FROM favorites WHERE id = ?");
    stmt.run(id);
  }

  private async addFavorite(url: string): Promise<Favorite | null> {
    try {
      const sanitizedCommand = `${ytDlpPath} ${url} --skip-download --flat-playlist --dump-single-json`;

      const { stdout } = await execAsync(sanitizedCommand, {
        maxBuffer: 1024 * 1024 * 10,
      });
      const output = JSON.parse(stdout);
      console.log(output);

      const insertStmt = this.db.prepare(
        "INSERT INTO favorites (title, display_id) VALUES (?, ?)"
      );

      const result = insertStmt.run(output.title, output.display_id);

      const getStmt = this.db.prepare(
        "SELECT * FROM favorites WHERE rowid = ?"
      );

      return getStmt.get(result.lastInsertRowid) as Favorite;
    } catch (error) {
      console.error("Error adding favorite:", error);
      return null;
    }
  }
}
