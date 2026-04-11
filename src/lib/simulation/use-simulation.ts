import type { SimulationInput, SimulationResult } from "./types";
import type { PrescriptionResult } from "@/lib/prescription";
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
  private pendingPrescription: {
    resolve: (value: PrescriptionResult) => void;
    reject: (reason: Error) => void;
  } | null = null;

  private setupWorkerHandlers(): void {
    if (!this.worker) return;
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === "result" && this.pending) {
        const { resolve } = this.pending;
        this.pending = null;
        resolve(e.data.data);
      } else if (e.data.type === "prescriptions" && this.pendingPrescription) {
        const { resolve } = this.pendingPrescription;
        this.pendingPrescription = null;
        resolve(e.data.data);
      } else if (e.data.type === "error") {
        if (this.pending) {
          const { reject } = this.pending;
          this.pending = null;
          reject(new Error(e.data.message));
        }
        if (this.pendingPrescription) {
          const { reject } = this.pendingPrescription;
          this.pendingPrescription = null;
          reject(new Error(e.data.message));
        }
      }
    };
    this.worker.onerror = (e) => {
      const err = new Error(e.message || "Worker error");
      if (this.pending) {
        const { reject } = this.pending;
        this.pending = null;
        reject(err);
      }
      if (this.pendingPrescription) {
        const { reject } = this.pendingPrescription;
        this.pendingPrescription = null;
        reject(err);
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

  async prescribe(
    input: SimulationInput,
    targetRate: number,
    seed: number,
  ): Promise<PrescriptionResult> {
    if (!this.worker) {
      const { generatePrescriptions } = await import("@/lib/prescription");
      return generatePrescriptions(input, targetRate, seed);
    }

    if (this.pendingPrescription) {
      this.pendingPrescription.reject(new Error("Superseded"));
      this.pendingPrescription = null;
    }

    return new Promise((resolve, reject) => {
      this.pendingPrescription = { resolve, reject };
      this.worker!.postMessage({
        type: "prescribe",
        input,
        targetRate,
        seed,
      } satisfies WorkerMessage);
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
