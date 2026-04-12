import { useState, useEffect, useMemo } from "react";
import { loadScenarios, formToSimulationInput } from "@/lib/form-state";
import type { Scenario } from "@/lib/form-state";
import type { SimulationWorker } from "@/lib/simulation";
import { runSimulation } from "@/lib/simulation";
import type { SimulationResult } from "@/lib/simulation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ScenarioCompareProps {
  worker: SimulationWorker | null;
  onBack: () => void;
}

interface ScenarioResult {
  scenario: Scenario;
  result: SimulationResult | null;
  calculating: boolean;
}

function formatYen(n: number): string {
  return `${Math.round(n / 10000).toLocaleString()}万円`;
}

function SuccessBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color =
    pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-danger";
  const textColor =
    pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-danger";
  const icon = pct >= 80 ? "✅" : pct >= 50 ? "⚠️" : "❌";
  return (
    <div>
      <span className={`text-3xl font-bold ${textColor}`}>
        <span aria-hidden="true">{icon} </span>{pct}%
      </span>
      <div className="w-full bg-muted rounded-full h-2 mt-1">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ScenarioCompare({ worker, onBack }: ScenarioCompareProps) {
  const scenarios = useMemo(() => loadScenarios(), []);
  const [results, setResults] = useState<ScenarioResult[]>(
    scenarios.map((s) => ({ scenario: s, result: null, calculating: true }))
  );

  useEffect(() => {
    let cancelled = false;

    async function runAll() {
      for (let i = 0; i < scenarios.length; i++) {
        if (cancelled) return;
        const input = formToSimulationInput(scenarios[i].form);
        try {
          const result = worker
            ? await worker.run(input)
            : runSimulation(input);
          if (cancelled) return;
          setResults((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, result, calculating: false } : r
            )
          );
        } catch {
          if (cancelled) return;
          const result = runSimulation(input);
          setResults((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, result, calculating: false } : r
            )
          );
        }
      }
    }

    runAll();
    return () => { cancelled = true; };
  }, [scenarios, worker]);

  if (scenarios.length < 2) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-muted-foreground">比較するには2つ以上のシナリオを保存してください。</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          戻る
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">シナリオ比較</h2>
        <Button variant="outline" onClick={onBack}>
          戻る
        </Button>
      </div>

      {/* 比較テーブル */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(results.length, 3)}, 1fr)` }}>
        {results.map(({ scenario, result, calculating }) => (
          <Card key={scenario.id}>
            <CardHeader>
              <CardTitle className="text-base">{scenario.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {calculating ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" />
                </div>
              ) : result ? (
                <>
                  <SuccessBar rate={result.successRate} />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">退職年齢</span>
                      <span className="font-medium">{scenario.form.retirementAge}歳</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">月間生活費</span>
                      <span className="font-medium">{scenario.form.monthlyExpense.toLocaleString()}円</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">年収</span>
                      <span className="font-medium">{formatYen(scenario.form.annualSalary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">総資産</span>
                      <span className="font-medium">
                        {formatYen(scenario.form.portfolio.reduce((s, e) => s + e.amount, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">中央値最終資産</span>
                      <span className="font-medium">
                        {formatYen(result.percentiles.p50[result.percentiles.p50.length - 1] ?? 0)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-destructive">計算エラー</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* サマリー比較 */}
      {results.every((r) => r.result) && (
        <Card>
          <CardHeader>
            <CardTitle>サマリー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">指標</th>
                    {results.map((r) => (
                      <th key={r.scenario.id} className="text-right py-2 px-2">
                        {r.scenario.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4 text-muted-foreground">成功確率</td>
                    {results.map((r) => (
                      <td key={r.scenario.id} className="text-right py-2 px-2 font-bold">
                        {Math.round((r.result?.successRate ?? 0) * 100)}%
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 text-muted-foreground">退職年齢</td>
                    {results.map((r) => (
                      <td key={r.scenario.id} className="text-right py-2 px-2">
                        {r.scenario.form.retirementAge}歳
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 text-muted-foreground">月間生活費</td>
                    {results.map((r) => (
                      <td key={r.scenario.id} className="text-right py-2 px-2">
                        {r.scenario.form.monthlyExpense.toLocaleString()}円
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 text-muted-foreground">中央値最終資産</td>
                    {results.map((r) => (
                      <td key={r.scenario.id} className="text-right py-2 px-2">
                        {formatYen(r.result?.percentiles.p50[r.result.percentiles.p50.length - 1] ?? 0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
