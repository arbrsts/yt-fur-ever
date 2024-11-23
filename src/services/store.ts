import { configureStore } from "@reduxjs/toolkit";
import { favoritesApi } from "./favoriteService";
import { collectionApi } from "./collectionService";
import { settingsApi } from "./settingsService";

export const store = configureStore({
  reducer: {
    [favoritesApi.reducerPath]: favoritesApi.reducer,
    [collectionApi.reducerPath]: collectionApi.reducer,
    [settingsApi.reducerPath]: settingsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      favoritesApi.middleware,
      collectionApi.middleware,
      settingsApi.middleware
    ),
});
