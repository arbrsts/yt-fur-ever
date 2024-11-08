import { createApi } from "@reduxjs/toolkit/query/react";
import { electronBaseQuery } from "./utils";

type Favorite = {
  id: string;
};

export const favoritesApi = createApi({
  reducerPath: "favoritesApi",
  baseQuery: electronBaseQuery(),
  tagTypes: ["Favorites"],
  endpoints: (builder) => ({
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
  }),
});

// Export hooks for usage in components
export const {
  useGetFavoritesQuery,
  useAddFavoriteMutation,
  useRemoveFavoriteMutation,
} = favoritesApi;
