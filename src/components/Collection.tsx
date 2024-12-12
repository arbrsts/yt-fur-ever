import { Button } from "../ui/Button";

import { fureverApi } from "../services/fureverService";

export const Collection = () => {
  const { data: downloaded } = fureverApi.useGetCollectionQuery();

  const [startYtDlp] = fureverApi.useStartYtDlpMutation();
  const { data } = fureverApi.useYtDlpStatusQuery();
  const [setSetting] = fureverApi.useSetSettingMutation();

  console.log(data);
  const { data: setting } = fureverApi.useGetSettingQuery({ key: "savePath" });

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
      {downloaded &&
        downloaded.map((downloaded) => (
          <div key={downloaded}>- {downloaded}</div>
        ))}
    </div>
  );
};
