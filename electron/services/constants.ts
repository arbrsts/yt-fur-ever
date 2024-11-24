export const IPC_CHANNELS = {
  SETTINGS: {
    GET: "settings-get",
    SET: "settings-set",
  },
  FAVORITES: {
    GET: "favorites-get",
    ADD: "favorites-add",
    REMOVE: "favorites-remove",
  },
  DOWNLOAD: {
    CANCEL: "download-cancel",
    SYNC_COLLECTION: "sync-collection",
    // Events sent to renderer
    STATUS: "yt-dlp-status",
    UPDATE: "yt-dlp-update",
  },
  COLLECTION: {
    GET: "collection-get",
  },
  // Add other channel groups here
} as const;
