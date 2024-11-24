// src/ipc/types.ts
export interface SettingsGetParams {
  key: string;
}

export interface SettingsSetParams {
  key: string;
  value?: string;
  type?: "path" | "string" | "number" | "boolean";
}
