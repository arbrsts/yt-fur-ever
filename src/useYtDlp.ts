import { useState, useEffect, useCallback } from "react";

export function useYtDlp() {
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useEffect(() => {
    window?.ipcRenderer?.onYtDlpOutput((data) => {
      setOutput((prev) => prev + data);
    });

    window.ipcRenderer?.onYtDlpError((data) => {
      setError((prev) => prev + data);
    });

    return () => {
      window.ipcRenderer?.removeYtDlpListeners();
    };
  }, []);

  const runYtDlp = useCallback(async (url: string) => {
    console.log("setting true");
    setIsRunning(true);
    setOutput("");
    setError("");

    try {
      await window.ipcRenderer.invoke("sync-collection");
      console.log("yt-dlp process completed successfully");
    } catch (error) {
      console.error("yt-dlp process failed:", error);
      throw error;
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { runYtDlp, output, error, isRunning };
}
