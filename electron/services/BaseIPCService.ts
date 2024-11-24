import { IpcMain } from "electron";

export abstract class BaseIpcService {
  constructor(protected readonly ipcMain: IpcMain) {
    this.registerChannels();
  }

  // Force implementation of registerHandlers
  protected abstract registerChannels(): void;

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
