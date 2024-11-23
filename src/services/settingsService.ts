import { createApi } from "@reduxjs/toolkit/query/react";
import { electronBaseQuery } from "./utils";

type Setting = string;

export const settingsApi = createApi({
  reducerPath: "settingsApi",
  baseQuery: electronBaseQuery(),
  tagTypes: ["Settings"],
  endpoints: (builder) => ({
    getSetting: builder.query<Setting, { key: string }>({
      query: (params: { key: string }) => ({
        url: "settings-get",
        args: [params],
      }),
      providesTags: ["Settings"],
    }),
    setSetting: builder.mutation({
      query: (params: { key: string; value: any; type: string }) => ({
        url: "settings-set",
        args: [params],
      }),
      invalidatesTags: ["Settings"],
    }),
  }),
});

// Export hooks for usage in components
export const { useGetSettingQuery, useSetSettingMutation } = settingsApi;
