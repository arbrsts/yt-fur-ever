import { useState } from "react";
import "./App.css";
import { useYtDlp } from "./useYtDlp";
import { Button } from "./ui/Button";
import {
  useAddFavoriteMutation,
  useGetFavoritesQuery,
  useRemoveFavoriteMutation,
} from "./services/favoriteService";
import { Collection } from "./components/Collection";

function App() {
  const [url, setUrl] = useState<string>("");

  const {
    data: favorites,
    isLoading,
    error: favoriteError,
  } = useGetFavoritesQuery();

  const [addFavorite] = useAddFavoriteMutation();
  const [removeFavorite] = useRemoveFavoriteMutation();

  const [newFavorite, setNewFavorite] = useState();

  return (
    <>
      <div className="flex gap-2 bg-neutral-900 w-screen h-screen p-1">
        <div className="border p-4">
          <h1>Favorites</h1>

          <div className="flex mb-4 gap-2">
            <input
              className="border p-1  bg-neutral-900"
              value={newFavorite}
              onChange={(e) => {
                setNewFavorite(e.target.value);
              }}
            ></input>
            <Button
              onPress={() => {
                addFavorite(newFavorite);
              }}
            >
              Add
            </Button>
          </div>

          <div className="flex flex-col gap-2  ">
            {favorites &&
              favorites.map((favorite) => {
                return (
                  <div className="bg-neutral-800 p-2">
                    <div className="flex justify-between">
                      <h2 className="font-medium text-lg">{favorite.title}</h2>
                      <Button
                        onPress={() => {
                          removeFavorite(favorite.id);
                        }}
                      >
                        Remove
                      </Button>
                    </div>

                    <p>{favorite.url}</p>
                  </div>
                );
              })}
          </div>
        </div>

        <Collection />
      </div>
    </>
  );
}

export default App;
