import { useState, useRef, useEffect, useCallback } from "react";
import type { FormState } from "@/lib/form-state";
import { formToSimulationInput, loadScenarios } from "@/lib/form-state";
import type { Scenario } from "@/lib/form-state";
import { SimulationWorker } from "@/lib/simulation";
import type { SimulationResult } from "@/lib/simulation";
import { Wizard } from "@/components/wizard";
import { Results } from "@/components/results";
import { ScenarioCompare } from "@/components/scenario-compare";
import { ThemeToggle } from "@/components/theme-toggle";
import { MethodologyPage } from "@/components/methodology/methodology-page";
import { parseShareHash } from "@/lib/url-share";
import { Flame } from "lucide-react";

type AppState =
  | { phase: "input" }
  | { phase: "calculating"; form: FormState }
  | { phase: "result"; form: FormState; result: SimulationResult }
  | { phase: "compare" }
  | { phase: "methodology" };

export default function App() {
  const [state, setState] = useState<AppState>({ phase: "input" });
  const [scenarioCount, setScenarioCount] = useState(() => loadScenarios().length);
  const [sharedBanner, setSharedBanner] = useState(false);
  const workerRef = useRef<SimulationWorker | null>(null);

  useEffect(() => {
    workerRef.current = new SimulationWorker();
    return () => {
      workerRef.current?.dispose();
      workerRef.current = null;
    };
  }, []);

  // 共有URLからの復元
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#s=")) return;
    const form = parseShareHash(hash);
    // ハッシュをクリア（リロードループ防止）
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!form) return;
    setSharedBanner(true);
    handleComplete(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // input画面に戻るたびにシナリオ数を更新
  useEffect(() => {
    if (state.phase === "input") {
      setScenarioCount(loadScenarios().length);
    }
  }, [state.phase]);

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-background focus:text-foreground focus:border"
      >
        メインコンテンツへスキップ
      </a>
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1
            className="text-lg font-bold cursor-pointer flex items-center gap-1.5"
            onClick={() => setState({ phase: "input" })}
          >
            <Flame className="h-5 w-5 text-orange-500" aria-hidden="true" />
            FIRE参謀
          </h1>
          <nav aria-label="メインナビゲーション" className="flex items-center gap-2">
            {scenarioCount >= 2 && state.phase === "input" && (
              <button
                onClick={() => setState({ phase: "compare" })}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                シナリオ比較
              </button>
            )}
            <button
              onClick={() => setState({ phase: "methodology" })}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              計算根拠
            </button>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main id="main-content" className="py-8 px-4">
        {state.phase === "input" && <Wizard onComplete={handleComplete} />}
        {state.phase === "calculating" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-sm text-muted-foreground">シミュレーション実行中...</p>
          </div>
        )}
        {state.phase === "result" && (
          <>
            {sharedBanner && (
              <div className="max-w-6xl mx-auto mb-4 rounded-lg bg-primary/10 px-4 py-2 text-center text-sm text-primary">
                共有されたプランを表示中
              </div>
            )}
            <Results
              initialForm={state.form}
              initialResult={state.result}
              worker={workerRef.current}
              onBack={() => { setSharedBanner(false); setState({ phase: "input" }); }}
            />
          </>
        )}
        {state.phase === "compare" && (
          <ScenarioCompare
            worker={workerRef.current}
            onBack={() => setState({ phase: "input" })}
          />
        )}
        {state.phase === "methodology" && (
          <MethodologyPage onBack={() => setState({ phase: "input" })} />
        )}
      </main>

      <footer className="border-t mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground space-y-1">
          <p>本ツールはシミュレーションであり、投資助言・税務助言ではありません。</p>
          <p>過去の市場データに基づく確率的推計であり、将来の投資成果を保証するものではありません。実際の資産運用・税務処理は専門家にご相談ください。</p>
        </div>
      </footer>
    </div>
  );
}
