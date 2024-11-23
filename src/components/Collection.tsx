import { useState, useEffect } from "react";
import { Button } from "../ui/Button";
import {
  useStartYtDlpMutation,
  useYtDlpStatusQuery,
} from "../services/collectionService";
import {
  useGetSettingQuery,
  useSetSettingMutation,
} from "../services/settingsService";

export const Collection = () => {
  const [url, setUrl] = useState<string>("");

  const [downloaded, setDownloaded] = useState([]);
  useEffect(() => {
    const fetchData = async () => {
      const saved = await window.electron.invoke("test");
      setDownloaded(saved);
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const savePath = await window.electron.invoke("settings-get", "savePath");
      setLocation(savePath);
    };

    fetchData();
  }, []);

  const [location, setLocation] = useState();

  const [startYtDlp] = useStartYtDlpMutation();
  const { data } = useYtDlpStatusQuery();
  const [setSetting] = useSetSettingMutation();
  const { data: setting } = useGetSettingQuery({ key: "savePath" });

  return (
    <div className="border p-4">
      <h1 className="mb-2">Collection</h1>
      <div className="mb-2">
        <Button
          onPress={() => {
            startYtDlp();
          }}
        >
          Sync collection
        </Button>

        <div className="flex flex-col gap-1">
          {data?.queue &&
            data?.queue.map((queuedItem) => {
              return <div className="bg-neutral-800">{queuedItem.url}</div>;
            })}
        </div>

        {data?.isRunning && <div>Download in progress...</div>}
      </div>
      <Button
        onPress={() => {
          window.electron.invoke("download-cancel");
        }}
      >
        Cancel
      </Button>
      <Button
        onPress={() => {
          setSetting({ key: "savePath", type: "path" });
          // const location = window.electron.invoke("choose-location");
        }}
      >
        Choose Download Folder
      </Button>
      <div>{setting}</div>
      <h2 className="font-bold">Downloaded</h2>
      {downloaded.map((downloaded) => (
        <div>- {downloaded}</div>
      ))}
    </div>
  );
};
