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
      "CREATE TABLE IF NOT EXISTS favorites (_id INTEGER NOT NULL PRIMARY KEY, id VARCHAR(255) NOT NULL UNIQUE, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, type VARCHAR(255), title VARCHAR(255), parent_id INTEGER(255), FOREIGN KEY (parent_id) REFERENCES favorites(_id));"
    );
  }

  public getFavorites(): Favorite[] {
    const stmt = this.db.prepare(
      "SELECT f.*, d.downloaded FROM favorites f LEFT JOIN download d ON f.id= d.id;"
    );
    return stmt.all() as Favorite[];
  }

  private removeFavorite(id: number): void {
    const stmt = this.db.prepare("DELETE FROM favorites WHERE id = ?");
    stmt.run(id);
  }

  private async getYTJSONDump(url) {
    const sanitizedCommand = `${ytDlpPath} ${url} --skip-download --flat-playlist --dump-single-json`;
    const { stdout } = await execAsync(sanitizedCommand, {
      maxBuffer: 1024 * 1024 * 10,
    });

    return JSON.parse(stdout);
  }

  private async addFavorite(url: string): Promise<Favorite | null> {
    try {
      const sanitizedCommand = `${ytDlpPath} ${url} --skip-download --flat-playlist --dump-single-json`;

      const { stdout } = await execAsync(sanitizedCommand, {
        maxBuffer: 1024 * 1024 * 10,
      });
      const output = JSON.parse(stdout);

      if (output._type == "playlist") {
        // Add parent playlist to satisfy foreign key constraint
        const parentInsertionResult = this.db
          .prepare("INSERT INTO favorites (id, type, title) VALUES (?, ?, ?)")
          .run(output.channel_id, "playlist", output.title);

        const parentPlaylistId = parentInsertionResult.lastInsertRowid;

        for (const entry of output.entries) {
          if (entry._type == "playlist") {
            const playlist = await this.getYTJSONDump(entry.webpage_url);

            playlist.entries.forEach((entry) => {
              const newInsertStmt = this.db.prepare(
                "INSERT INTO favorites (id, type, title, parent_id) VALUES (?, ?, ?, ?)"
              );
              newInsertStmt.run(entry.id, "url", entry.title, parentPlaylistId);
            });
          }
        }
      } else {
        this.db
          .prepare("INSERT INTO favorites (id, type, title) VALUES (?, ?, ?)")
          .run(output.id, "url", output.title);

        const getStmt = this.db.prepare(
          "SELECT * FROM favorites WHERE rowid = ?"
        );

        return getStmt.get(result.lastInsertRowid) as Favorite;
      }
    } catch (error) {
      console.error("Error adding favorite:", error);
      return null;
    }
  }
}
