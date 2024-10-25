import { useEffect, useState } from "react";
import "./App.css";
import { Input, Label, TextField } from "react-aria-components";
import { useYtDlp } from "./useYtDlp";

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

  return (
    <>
      <div className="flex">
        <div>
          <button
            onClick={() => {
              handleRunCommand()
            }}
          >
            Sync collection
          </button>
          {isRunning ? "Running" : "Finished"}
          <pre>{output}</pre>
          {error && <pre style={{ color: "red" }}>{error}</pre>}
          <h2>Favorites</h2>
          {JSON.stringify(favorites)}
        </div>

        <div>
          <h2>Downloaded</h2>
          {JSON.stringify(downloaded)}
        </div>
        <div>
          <input
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
