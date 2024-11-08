import { createApi } from "@reduxjs/toolkit/query/react";
import { electronBaseQuery } from "./utils";

type Status = {
  output: string;
  error: string;
  isRunning: boolean;
  queue: string[];
};

export const collectionApi = createApi({
  reducerPath: "collectionApi",
  baseQuery: electronBaseQuery(),
  endpoints: (builder) => ({
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
        window.electron.on("yt-dlp-update", (event, status) =>
          updateHandler(status)
        );

        await cacheEntryRemoved;
        window.electron.removeYtDlpListeners();
      },
    }),
  }),
});

export const { useStartYtDlpMutation, useYtDlpStatusQuery } = collectionApi;
