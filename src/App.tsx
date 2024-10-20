import { useEffect, useState } from "react";
import "./App.css";
import { Input, Label, TextField } from "react-aria-components";
import { useYtDlp } from "./useYtDlp";
import { ipcMain, ipcRenderer } from "electron";
import { Button } from "./components/Button";
import { CRTEffect } from "./threetest";

function App() {
  const [url, setUrl] = useState<string>("");
  const { runYtDlp, output, error, isRunning } = useYtDlp();

  const handleRunCommand = async () => {
    try {
      await runYtDlp(url);
    } catch (error) {
      console.error("Failed to run yt-dlp:", error);
    }
  };

  const [favorites, setFavorites] = useState([]);
  useEffect(() => {
    const fetchData = async () => {
      const saved = await window.ipcRenderer.invoke("favorites-get");
      setFavorites(saved);
    };

    fetchData();
  }, []);

  const [downloaded, setDownloaded] = useState([]);
  useEffect(() => {
    const fetchData = async () => {
      const saved = await window.ipcRenderer.invoke("test");
      setDownloaded(saved);
    };

    fetchData();
  }, []);

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
                window.ipcRenderer.invoke("favorites-add", newFavorite);
              }}
            >
              Add
            </Button>
          </div>

          <div className="flex flex-col gap-2  ">
            {favorites.map((favorite) => {
              return (
                <div className="bg-neutral-800 p-2">
                  <div className="flex justify-between">
                    <h2 className="font-medium text-lg">{favorite.title}</h2>
                    <Button
                      onPress={() => {
                        window.ipcRenderer.invoke(
                          "favorites-remove",
                          favorite?.id
                        );
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

        <div className="border p-4">
          <h1 className="mb-2">Collection</h1>
          <div className="mb-2">
            <Button
              onPress={() => {
                handleRunCommand();
              }}
            >
              Sync collection
            </Button>
            {isRunning ? "Running" : "Finished"}
          </div>
          <div className="mb-2">
            <h2>Debug output:</h2>
            {error && <pre style={{ color: "red" }}>{error}</pre>}
            <pre className="w-80 h-40 border overflow-auto">{output}</pre>
          </div>
          <h2 className="font-bold">Downloaded</h2>
          {downloaded.map((downloaded) => (
            <div>- {downloaded}</div>
          ))}
        </div>
        <div className="border p-4">
          <h1 className="mb-4">One-off</h1>
          <input
            className="bg-neutral-900 border p-1"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter YouTube URL"
          />
          <button onClick={handleRunCommand} disabled={isRunning}>
            {isRunning ? "Running..." : "Run yt-dlp"}
          </button>
        </div>
      </div>
    </>
  );
}

export default App;
