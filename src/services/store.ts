import { configureStore } from "@reduxjs/toolkit";
import { favoritesApi } from "./favoriteService";
import { collectionApi } from "./collectionService";

export const store = configureStore({
  reducer: {
    [favoritesApi.reducerPath]: favoritesApi.reducer,
    [collectionApi.reducerPath]: collectionApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      favoritesApi.middleware,
      collectionApi.middleware
    ),
});
