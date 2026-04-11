import type { SimulationInput, SimulationResult } from "./types";
import type { WorkerMessage, WorkerResponse } from "./worker";

/**
 * メインスレッド側のWorkerラッパー
 * Web Worker非対応環境ではメインスレッドにフォールバック
 */
export class SimulationWorker {
  private worker: Worker | null = null;
  private pending: {
    resolve: (value: SimulationResult) => void;
    reject: (reason: Error) => void;
  } | null = null;

  private setupWorkerHandlers(): void {
    if (!this.worker) return;
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (!this.pending) return;
      const { resolve, reject } = this.pending;
      this.pending = null;

      if (e.data.type === "result") {
        resolve(e.data.data);
      } else {
        reject(new Error(e.data.message));
      }
    };
    this.worker.onerror = (e) => {
      if (this.pending) {
        const { reject } = this.pending;
        this.pending = null;
        reject(new Error(e.message || "Worker error"));
      }
    };
  }

  constructor() {
    if (typeof Worker !== "undefined") {
      this.worker = new Worker(
        new URL("./worker.ts", import.meta.url),
        { type: "module" }
      );
      this.setupWorkerHandlers();
    }
  }

  async run(input: SimulationInput): Promise<SimulationResult> {
    if (!this.worker) {
      // フォールバック: メインスレッドで実行
      const { runSimulation } = await import("./engine");
      return runSimulation(input);
    }

    // 前のpending promiseをキャンセル（上書き防止）
    if (this.pending) {
      this.pending.reject(new Error("Superseded"));
      this.pending = null;
    }

    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      this.worker!.postMessage({ type: "run", input } satisfies WorkerMessage);
    });
  }

  cancel(): void {
    if (this.worker && this.pending) {
      this.worker.terminate();
      this.pending.reject(new Error("Cancelled"));
      this.pending = null;
      // 新しいWorkerを再作成+ハンドラ再登録
      this.worker = new Worker(
        new URL("./worker.ts", import.meta.url),
        { type: "module" }
      );
      this.setupWorkerHandlers();
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
