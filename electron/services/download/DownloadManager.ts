import { ChildProcess } from "child_process";
import { spawn } from "child_process";
import { SettingsService } from "../settings/service";
import { ytDlpPath } from "../../main";

type CurrentDownload = {
  queueItem: { url: string };
  process: ChildProcess;
  state: "ERROR" | "STARTED" | "SUCCESS";
};

type QueueItem = { url: string };
type Queue = QueueItem[];

export class DownloadManager {
  public queue: Queue = [];
  private currentDownload?: {
    queueItem: { url: string };
    process: ChildProcess;
    state: "ERROR" | "STARTED" | "SUCCESS";
  };
  public isProcessing = false; // Add this flag
  private onFinish;
  private onStdout;
  private onStderr;
  private onQueueUpdate;
  private onCurrentDownloadUpdate;

  constructor({
    onFinish,
    onStdout,
    onStderr,
    onQueueUpdate,
    onCurrentDownloadUpdate,
    settings,
  }: {
    /*
      Callbacks
    */
    onFinish: () => void;
    onStdout: () => void;
    onStderr: () => void;
    onQueueUpdate: (queue: Queue) => void;
    onCurrentDownloadUpdate: (currentDownload: CurrentDownload) => void;

    settings: SettingsService;
  }) {
    this.onFinish = onFinish;
    this.onStdout = onStdout;
    this.onStderr = onStderr;
    this.onQueueUpdate = onQueueUpdate;
    this.onCurrentDownloadUpdate = onCurrentDownloadUpdate;

    this.settings = settings;
  }

  add(url: string) {
    this.queue.push({ url });

    this.onQueueUpdate(this.queue);

    if (!this.isProcessing) {
      this.isProcessing = true;
      this.onFinish(this.isProcessing);
      this.processNext();
    }
  }

  processNext() {
    console.log("processing", this.queue);
    const downloadCommand = `${ytDlpPath}  ${
      this.queue[0].url
    } --embed-thumbnail -f bestaudio -x --audio-format mp3 --audio-quality 320k --embed-metadata -P ${this.settings.getSetting(
      "savePath"
    )}`;

    const ytDlp = spawn(downloadCommand, [], { shell: true });

    this.currentDownload = {
      queueItem: this.queue[0],
      process: ytDlp,
      state: "STARTED",
    };

    const onStdout = this.onStdout;
    const onStderr = this.onStderr;

    if (onStdout) ytDlp.stdout.on("data", onStdout);
    if (onStderr) ytDlp.stderr.on("data", onStderr);

    // Add close handler
    ytDlp.on("close", (code) => {
      this.queue.shift();

      if (this.currentDownload?.process.exitCode !== 0) {
        this.currentDownload.state = "ERROR";
      } else {
        this.currentDownload.state = "SUCCESS";
      }

      this.onCurrentDownloadUpdate(this.currentDownload);

      this.onQueueUpdate(this.queue);
      this.currentDownload = undefined;
      if (this.queue.length > 0) {
        this.processNext(); // Process next in queue
      } else {
        this.isProcessing = false;
        this.onFinish(this.isProcessing);
      }
    });
  }

  cancel() {
    if (process.platform === "win32") {
      // Kill all known related processes
      const processesToKill = [
        "yt-dlp.exe",
        "ffmpeg.exe",
        "ffprobe.exe",
        "AtomicParsley.exe", // Used for embedding thumbnails
      ];

      processesToKill.forEach((processName) => {
        try {
          spawn("taskkill", ["/IM", processName, "/F"]);
        } catch (error) {
          console.error(`Failed to kill ${processName}:`, error);
        }
      });

      // Also kill by window title pattern as backup
      spawn("taskkill", ["/FI", "WINDOWTITLE eq *yt-dlp*", "/F"]);
      spawn("taskkill", ["/FI", "WINDOWTITLE eq *ffmpeg*", "/F"]);
    } else {
      // Unix systems
      ["yt-dlp", "ffmpeg", "ffprobe", "AtomicParsley"].forEach(
        (processName) => {
          try {
            spawn("pkill", ["-f", processName]);
          } catch (error) {
            console.error(`Failed to kill ${processName}:`, error);
          }
        }
      );
    }

    this.queue = [];
    this.currentDownload = undefined;

    this.onFinish(this.isProcessing);
    this.isProcessing = false;
  }
}
