import { IpcMain } from "electron";

export abstract class BaseIpcService {
  constructor(protected readonly ipcMain: IpcMain) {
    this.registerChannels();
    if (this.registerDatabase) this.registerDatabase();
  }

  // Force implementation of registerHandlers
  protected abstract registerChannels(): void;

  // Force implementation of registerHandlers
  protected abstract registerDatabase(): void;

  // Utility method for handler registration
  protected handle<T, R>(
    channel: string,
    handler: (params: T) => Promise<R> | R
  ) {
    this.ipcMain.handle(channel, async (_, params: T) => {
      try {
        return await handler(params);
      } catch (error) {
        console.error(`Error in handler ${channel}:`, error);
        throw error;
      }
    });
  }
}
