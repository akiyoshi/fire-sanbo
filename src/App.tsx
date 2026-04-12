import { useState, useRef, useEffect } from "react";
import type { FormState } from "@/lib/form-state";
import { formToSimulationInput } from "@/lib/form-state";
import { SimulationWorker } from "@/lib/simulation";
import type { SimulationResult } from "@/lib/simulation";
import { Wizard } from "@/components/wizard";
import { Results } from "@/components/results";
import { ThemeToggle } from "@/components/theme-toggle";

type AppState =
  | { phase: "input" }
  | { phase: "calculating"; form: FormState }
  | { phase: "result"; form: FormState; result: SimulationResult };

export default function App() {
  const [state, setState] = useState<AppState>({ phase: "input" });
  const workerRef = useRef<SimulationWorker | null>(null);

  useEffect(() => {
    workerRef.current = new SimulationWorker();
    return () => {
      workerRef.current?.dispose();
      workerRef.current = null;
    };
  }, []);

  const handleComplete = async (form: FormState) => {
    setState({ phase: "calculating", form });
    const input = formToSimulationInput(form);
    const worker = workerRef.current;
    if (worker) {
      try {
        const result = await worker.run(input);
        setState({ phase: "result", form, result });
      } catch {
        // Worker失敗時はメインスレッドフォールバック
        const { runSimulation } = await import("@/lib/simulation");
        const result = runSimulation(input);
        setState({ phase: "result", form, result });
      }
    } else {
      const { runSimulation } = await import("@/lib/simulation");
      const result = runSimulation(input);
      setState({ phase: "result", form, result });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">
            🔥 FIRE参謀
          </h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="py-8 px-4">
        {state.phase === "input" && <Wizard onComplete={handleComplete} />}
        {state.phase === "calculating" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-sm text-muted-foreground">シミュレーション実行中...</p>
          </div>
        )}
        {state.phase === "result" && (
          <Results
            initialForm={state.form}
            initialResult={state.result}
            worker={workerRef.current}
            onBack={() => setState({ phase: "input" })}
          />
        )}
      </main>

      <footer className="border-t mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-3 text-center text-xs text-muted-foreground">
          FIRE参謀はシミュレーションツールです。投資判断はご自身の責任で行ってください。
        </div>
      </footer>
    </div>
  );
}
