import { runSimulation } from "./engine";
import type { SimulationInput, SimulationResult } from "./types";

export type WorkerMessage =
  | { type: "run"; input: SimulationInput }
  | { type: "cancel" };

export type WorkerResponse =
  | { type: "result"; data: SimulationResult }
  | { type: "error"; message: string };

/**
 * Web Worker のエントリポイント
 * self.onmessage で受け取って実行
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any;

ctx.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  if (msg.type === "run") {
    try {
      const result = runSimulation(msg.input);
      ctx.postMessage({ type: "result", data: result } satisfies WorkerResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.postMessage({ type: "error", message } satisfies WorkerResponse);
    }
  }
};
