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
        const res = await window.electron.invoke("sync-collection");
        return res;
      },
    }),

    ytDlpStatus: builder.query<Status, void>({
      queryFn: () => ({
        data: { output: "", error: "", isRunning: false },
      }),

      onCacheEntryAdded: async (
        arg,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved }
      ) => {
        await cacheDataLoaded;

        const outputHandler = (data: string) => {
          console.log("output running");
          updateCachedData((draft) => {
            draft.output += data;
          });
        };

        const errorHandler = (data: string) => {
          updateCachedData((draft) => {
            draft.error += data;
          });
        };

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

        window.electron.onYtDlpOutput(outputHandler);
        window.electron.onYtDlpError(errorHandler);
        window.electron.on("yt-dlp-status", (event, status) =>
          statusHandler(status)
        );
        window.electron.on("yt-dlp-update", (event, status) => {
          console.log("received");
          updateHandler(status);
        });

        await cacheEntryRemoved;
        window.electron.removeYtDlpListeners();
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
