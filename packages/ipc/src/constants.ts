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
    SYNC_COLLECTION: "download-sync",
    // Events sent to renderer
    STATUS_UPDATE: "yt-dlp-status",
    QUEUE_UPDATE: "yt-dlp-queue-update",
    CURRENT_DOWNLOAD_UPDATE: "yt-dlp-current-download-update",
  },
  COLLECTION: {
    GET: "collection-get",
  },
  // Add other channel groups here
} as const;
