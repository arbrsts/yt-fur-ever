import { useState } from "react";
import "./App.css";
import { Button } from "./ui/Button";
import { Collection } from "./components/Collection";
import { fureverApi } from "./services/fureverService";
import { LoadingSpinner } from "./ui/LoadingSpinner";
import { useDispatch } from "react-redux";

function App() {
  const {
    data: favorites,
    isLoading,
    error: favoriteError,
  } = fureverApi.useGetFavoritesQuery();

  const [addFavorite, { isLoading: isAddFavoriteLoading }] =
    fureverApi.useAddFavoriteMutation();
  const [removeFavorite] = fureverApi.useRemoveFavoriteMutation();

  const [newFavorite, setNewFavorite] = useState();
  const dispatch = useDispatch();

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

            <LoadingSpinner loading={isAddFavoriteLoading} />

            <Button
              onPress={() => {
                dispatch(fureverApi.util.invalidateTags(["Favorites"]));
              }}
            >
              Refresh
            </Button>
          </div>

          <div className="flex flex-col gap-2  ">
            {favorites &&
              favorites.map((favorite) => {
                return (
                  <div className="bg-neutral-800 p-2" key={favorite.created_at}>
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
                    <p>{favorite.display_id}</p>
                    <p>{favorite.downloaded ? "Downloaded" : ""}</p>
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
