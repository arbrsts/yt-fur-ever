import { createApi } from "@reduxjs/toolkit/query/react";
import { electronBaseQuery } from "./utils";

type Setting = string;

type Status = {
  output: string;
  error: string;
  isRunning: boolean;
  queue: string[];
};

type Favorite = {
  id: string;
};

import { IPC_CHANNELS } from "@yt-fur-ever/ipc";

/**
 * TODO: Add code splitting
 *
 * https://redux-toolkit.js.org/rtk-query/usage/code-splitting
 */
export const fureverApi = createApi({
  reducerPath: "fureverApi",
  baseQuery: electronBaseQuery(),
  tagTypes: ["Collection", "Favorites", "Settings"],
  endpoints: (builder) => ({
    /**
     * Collection
     */
    getCollection: builder.query<Setting, void>({
      query: () => ({
        url: "collection-get",
      }),
      providesTags: ["Collection"],
    }),

    /**
     * Download
     */
    startYtDlp: builder.mutation<void, void>({
      queryFn: async () => {
        const res = await window.electron.invoke(
          IPC_CHANNELS.DOWNLOAD.SYNC_COLLECTION
        );
        return res;
      },
    }),

    ytDlpStatus: builder.query<Status, void>({
      queryFn: () => ({
        data: { output: "", error: "", isRunning: false },
      }),

      onCacheEntryAdded: async (
        arg,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved, dispatch }
      ) => {
        await cacheDataLoaded;

        const statusHandler = (status: boolean) => {
          updateCachedData((draft) => {
            draft.isRunning = status;
          });
        };

        const updateHandler = (update: boolean) => {
          updateCachedData((draft) => {
            draft.queue = update;
          });
        };

        window.electron.on(
          IPC_CHANNELS.DOWNLOAD.STATUS_UPDATE,
          (event, status) => statusHandler(status)
        );
        window.electron.on(
          IPC_CHANNELS.DOWNLOAD.QUEUE_UPDATE,
          (event, status) => {
            updateHandler(status);
          }
        );
        window.electron.on(
          IPC_CHANNELS.DOWNLOAD.CURRENT_DOWNLOAD_UPDATE,
          (event, status) => {
            dispatch(fureverApi.util.invalidateTags(["Favorites"]));
          }
        );

        await cacheEntryRemoved;

        window.electron.off(IPC_CHANNELS.DOWNLOAD.QUEUE_UPDATE);
        window.electron.off(IPC_CHANNELS.DOWNLOAD.STATUS_UPDATE);
        window.electron.off(
          IPC_CHANNELS.DOWNLOAD.CURRENT_DOWNLOAD_UPDATE
        );
      },
    }),

    /**
     * Favorite
     */

    getFavorites: builder.query<Favorite, void>({
      query: () => ({
        url: "favorites-get",
      }),
      providesTags: ["Favorites"],
    }),
    addFavorite: builder.mutation({
      query: (url) => ({
        url: "favorites-add",
        args: [url],
      }),
      invalidatesTags: ["Favorites"],
    }),
    removeFavorite: builder.mutation({
      query: (id) => ({
        url: "favorites-remove",
        args: [id],
      }),
      invalidatesTags: ["Favorites"],
    }),

    /**
     * Settings
     */
    getSetting: builder.query<Setting, { key: string }>({
      query: (params: { key: string }) => ({
        url: "settings-get",
        args: [params],
      }),
      providesTags: ["Settings"],
    }),
    setSetting: builder.mutation({
      query: (params: { key: string; value?: any; type?: string }) => ({
        url: "settings-set",
        args: [params],
      }),
      invalidatesTags: ["Settings", "Collection"],
    }),
  }),
});
