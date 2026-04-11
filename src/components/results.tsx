"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import type { SimulationResult } from "@/lib/simulation";
import type { FormState } from "@/lib/form-state";
import { formToSimulationInput } from "@/lib/form-state";
import { runSimulation } from "@/lib/simulation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ResultsProps {
  initialForm: FormState;
  initialResult: SimulationResult;
  onBack: () => void;
}

function formatManYen(value: number): string {
  return `${Math.round(value / 10000).toLocaleString()}万`;
}

function SuccessRateDisplay({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color =
    pct >= 80
      ? "text-green-500"
      : pct >= 50
      ? "text-yellow-500"
      : "text-red-500";
  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground">FIRE成功確率</p>
      <p className={`text-6xl font-bold ${color}`}>{pct}%</p>
      <div className="w-full bg-muted rounded-full h-3 mt-2">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${
            pct >= 80
              ? "bg-green-500"
              : pct >= 50
              ? "bg-yellow-500"
              : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AssetChart({ result }: { result: SimulationResult }) {
  const data = useMemo(
    () =>
      result.ages.map((age, i) => ({
        age,
        // 信頼区間帯: [p5, p95] と [p25, p75] の範囲で描画
        band90: [result.percentiles.p5[i], result.percentiles.p95[i]] as [number, number],
        band50: [result.percentiles.p25[i], result.percentiles.p75[i]] as [number, number],
        p50: result.percentiles.p50[i],
      })),
    [result]
  );

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="age"
          label={{ value: "年齢", position: "insideBottomRight", offset: -5 }}
          className="text-xs"
        />
        <YAxis
          tickFormatter={formatManYen}
          label={{ value: "資産（万円）", angle: -90, position: "insideLeft" }}
          className="text-xs"
        />
        <Tooltip
          formatter={(value, name) => {
            if (Array.isArray(value)) {
              return `${formatManYen(Number(value[0]))} 〜 ${formatManYen(Number(value[1]))}`;
            }
            return formatManYen(Number(value));
          }}
          labelFormatter={(label) => `${label}歳`}
        />
        <Area
          type="monotone"
          dataKey="band90"
          name="5th-95th"
          stroke="none"
          fill="hsl(var(--chart-1))"
          fillOpacity={0.1}
        />
        <Area
          type="monotone"
          dataKey="band50"
          name="25th-75th"
          stroke="none"
          fill="hsl(var(--chart-1))"
          fillOpacity={0.2}
        />
        <Area
          type="monotone"
          dataKey="p50"
          name="中央値"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          fill="none"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Results({ initialForm, initialResult, onBack }: ResultsProps) {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(initialResult);
  const [isCalculating, setIsCalculating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateAndRecalc = useCallback(
    (key: keyof FormState, value: number) => {
      const newForm = { ...form, [key]: value };
      setForm(newForm);
      setIsCalculating(true);

      // debounce 300ms
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const input = formToSimulationInput(newForm);
        const newResult = runSimulation(input);
        setResult(newResult);
        setIsCalculating(false);
      }, 300);
    },
    [form]
  );

  const delta = useMemo(() => {
    const pct = Math.round(result.successRate * 100);
    const initialPct = Math.round(initialResult.successRate * 100);
    const diff = pct - initialPct;
    if (diff === 0) return null;
    return diff > 0 ? `+${diff}%` : `${diff}%`;
  }, [result.successRate, initialResult.successRate]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* 成功確率 */}
      <Card>
        <CardContent className="pt-6">
          <SuccessRateDisplay rate={result.successRate} />
        </CardContent>
      </Card>

      {/* ファンチャート */}
      <Card>
        <CardHeader>
          <CardTitle>資産推移（パーセンタイル）</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetChart result={result} />
        </CardContent>
      </Card>

      {/* What-if スライダー */}
      <Card>
        <CardHeader>
          <CardTitle>
            What-if シミュレーション
            {delta && (
              <span
                className={`ml-2 text-sm ${
                  delta.startsWith("+") ? "text-green-500" : "text-red-500"
                }`}
              >
                ({delta})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>退職年齢</Label>
              <span className="text-sm font-medium">
                {form.retirementAge}歳
              </span>
            </div>
            <Slider
              value={[form.retirementAge]}
              onValueChange={(v) => updateAndRecalc("retirementAge", Array.isArray(v) ? v[0] : v)}
              min={form.currentAge + 1}
              max={75}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>月間生活費</Label>
              <span className="text-sm font-medium">
                {form.monthlyExpense.toLocaleString()}円
              </span>
            </div>
            <Slider
              value={[form.monthlyExpense]}
              onValueChange={(v) => updateAndRecalc("monthlyExpense", Array.isArray(v) ? v[0] : v)}
              min={100000}
              max={500000}
              step={10000}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>期待リターン</Label>
              <span className="text-sm font-medium">
                {form.expectedReturn}%
              </span>
            </div>
            <Slider
              value={[form.expectedReturn]}
              onValueChange={(v) => updateAndRecalc("expectedReturn", Array.isArray(v) ? v[0] : v)}
              min={0}
              max={15}
              step={0.5}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>シミュレーション終了年齢</Label>
              <span className="text-sm font-medium">{form.endAge}歳</span>
            </div>
            <Slider
              value={[form.endAge]}
              onValueChange={(v) => updateAndRecalc("endAge", Array.isArray(v) ? v[0] : v)}
              min={form.retirementAge}
              max={100}
              step={1}
            />
          </div>
        </CardContent>
      </Card>

      {/* 取り崩し順序 */}
      <Card>
        <CardHeader>
          <CardTitle>口座取り崩し順序</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            現在の推奨順序: <strong>NISA → 特定口座 → iDeCo</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            NISA（非課税）を先に使い切ることで、課税口座の運用期間を最大化し税引後資産を最大化します。
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button variant="outline" onClick={onBack}>
          入力に戻る
        </Button>
      </div>
    </div>
  );
}
