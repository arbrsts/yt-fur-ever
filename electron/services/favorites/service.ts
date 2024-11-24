import { IpcMain } from "electron";
import { Database } from "better-sqlite3";
import { BaseIpcService } from "../BaseIPCService";
import util from "util";
import { exec } from "child_process";
import { IPC_CHANNELS } from "../constants";
import { AddFavoriteParams, Favorite, RemoveFavoriteParams } from "./types";

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

  public getFavorites(): Favorite[] {
    const stmt = this.db.prepare("SELECT * FROM favorites");
    return stmt.all() as Favorite[];
  }

  private removeFavorite(id: number): void {
    console.log("hi", id);
    const stmt = this.db.prepare("DELETE FROM favorites WHERE id = ?");
    stmt.run(id);
  }

  private async addFavorite(url: string): Promise<Favorite | null> {
    try {
      const sanitizedCommand = `.\\bin\\yt-dlp ${url} --skip-download --flat-playlist --dump-single-json`;

      const { stdout } = await execAsync(sanitizedCommand);
      const output = JSON.parse(stdout);

      const insertStmt = this.db.prepare(
        "INSERT INTO favorites (url, title) VALUES (?, ?)"
      );

      const result = insertStmt.run(url, output.title);

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
