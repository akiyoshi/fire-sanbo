"use client";

import { useState } from "react";
import type { FormState } from "@/lib/form-state";
import { formToSimulationInput } from "@/lib/form-state";
import { runSimulation } from "@/lib/simulation";
import type { SimulationResult } from "@/lib/simulation";
import { Wizard } from "@/components/wizard";
import { Results } from "@/components/results";
import { ThemeToggle } from "@/components/theme-toggle";

type AppState =
  | { phase: "input" }
  | { phase: "result"; form: FormState; result: SimulationResult };

export default function Home() {
  const [state, setState] = useState<AppState>({ phase: "input" });

  const handleComplete = (form: FormState) => {
    const input = formToSimulationInput(form);
    const result = runSimulation(input);
    setState({ phase: "result", form, result });
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
        {state.phase === "result" && (
          <Results
            initialForm={state.form}
            initialResult={state.result}
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
