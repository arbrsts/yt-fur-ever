import { configureStore } from "@reduxjs/toolkit";
import { fureverApi } from "./fureverService";

export const store = configureStore({
  reducer: {
    [fureverApi.reducerPath]: fureverApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(fureverApi.middleware),
});
