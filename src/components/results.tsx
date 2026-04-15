import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import type { SimulationResult } from "@/lib/simulation";
import type { SimulationWorker } from "@/lib/simulation";
import type { FormState } from "@/lib/form-state";
import { formToSimulationInput } from "@/lib/form-state";
import { runSimulation } from "@/lib/simulation";
import { optimizeWithdrawalOrder } from "@/lib/withdrawal";
import { PrescriptionCard } from "@/components/prescription-card";
import { TaxBreakdownCard } from "@/components/tax-breakdown-card";
import { WorstCaseCard } from "@/components/worst-case-card";
import { WithdrawalCard } from "@/components/withdrawal-card";
import { PortfolioOptimizer } from "@/components/portfolio-optimizer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link2, Check, ChevronRight, Lightbulb } from "lucide-react";
import { buildShareUrl } from "@/lib/url-share";
import type { PrescriptionResult } from "@/lib/prescription";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatManYen } from "@/lib/utils";

interface ResultsProps {
  initialForm: FormState;
  initialResult: SimulationResult;
  worker: SimulationWorker | null;
  onBack: () => void;
}

function SuccessRateDisplay({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color =
    pct >= 80
      ? "text-success"
      : pct >= 50
      ? "text-warning"
      : "text-danger";
  const icon = pct >= 80 ? "✅" : pct >= 50 ? "⚠️" : "❌";
  const interpretation =
    pct >= 90
      ? "非常に安全なプランです"
      : pct >= 80
      ? "十分安全圏です。微調整で90%超も可能"
      : pct >= 60
      ? "やや不安があります。退職時期や支出の調整を検討してください"
      : pct >= 40
      ? "リスクが高い状態です。大幅な見直しが必要です"
      : "現在のプランでは資産が不足する可能性が高いです";
  return (
    <div className="text-center" role="status" aria-label={`FIRE成功確率 ${pct}パーセント`}>
      <p className="text-sm text-muted-foreground">FIRE成功確率</p>
      <p className={`text-6xl font-bold ${color}`}>
        <span aria-hidden="true">{icon} </span>{pct}%
      </p>
      <p className="text-sm text-muted-foreground mt-1">{interpretation}</p>
      <div className="w-full bg-muted rounded-full h-3 mt-2">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${
            pct >= 80
              ? "bg-success"
              : pct >= 50
              ? "bg-warning"
              : "bg-danger"
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
    <>
    <div role="img" aria-label="資産推移チャート。5〜95パーセンタイルの信頼区間と中央値を表示" className="h-[250px] sm:h-[350px]">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="age"
          label={{ value: "年齢", position: "insideBottomRight", offset: -5 }}
          className="text-xs"
        />
        <YAxis
          tickFormatter={(v) => formatManYen(v)}
          width={80}
          label={{ value: "資産（万円）", angle: -90, position: "insideLeft", offset: 10 }}
          className="text-xs"
        />
        <Tooltip
          formatter={(value, _name) => {
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
          fill="var(--chart-1)"
          fillOpacity={0.15}
        />
        <Area
          type="monotone"
          dataKey="band50"
          name="25th-75th"
          stroke="none"
          fill="var(--chart-1)"
          fillOpacity={0.3}
        />
        <Area
          type="monotone"
          dataKey="p50"
          name="中央値"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="none"
        />
      </AreaChart>
    </ResponsiveContainer>
    </div>
    <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "var(--chart-1)", opacity: 0.3 }} />
        90%信頼区間
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "var(--chart-1)", opacity: 0.5 }} />
        50%信頼区間
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-6 h-0.5" style={{ background: "var(--chart-1)" }} />
        中央値
      </span>
    </div>
    <details className="mt-2">
      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
        データテーブルで見る
      </summary>
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-xs border-collapse">
          <caption className="sr-only">資産推移データ（5年間隔）</caption>
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 pr-3 font-medium">年齢</th>
              <th className="text-right py-1 px-2 font-medium">p5</th>
              <th className="text-right py-1 px-2 font-medium">p25</th>
              <th className="text-right py-1 px-2 font-medium">中央値</th>
              <th className="text-right py-1 px-2 font-medium">p75</th>
              <th className="text-right py-1 px-2 font-medium">p95</th>
            </tr>
          </thead>
          <tbody>
            {data.filter((_, i) => i % 5 === 0 || i === data.length - 1).map((row) => (
              <tr key={row.age} className="border-b border-muted">
                <td className="py-1 pr-3">{row.age}歳</td>
                <td className="text-right py-1 px-2">{formatManYen(row.band90[0])}</td>
                <td className="text-right py-1 px-2">{formatManYen(row.band50[0])}</td>
                <td className="text-right py-1 px-2 font-medium">{formatManYen(row.p50)}</td>
                <td className="text-right py-1 px-2">{formatManYen(row.band50[1])}</td>
                <td className="text-right py-1 px-2">{formatManYen(row.band90[1])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
    </>
  );
}

function ShareButton({ form }: { form: FormState }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const base = window.location.origin + window.location.pathname;
    const url = buildShareUrl(form, base);

    if (navigator.share) {
      try {
        await navigator.share({ title: "FIRE参謀 シミュレーション結果", url });
        return;
      } catch {
        // ユーザーがキャンセル or 非対応 → clipboard fallback
      }
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard API 非対応 → 何もしない
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [form]);

  return (
    <div className="flex justify-center mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={handleShare}
        className="gap-1.5"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" aria-hidden="true" />
            コピーしました
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4" aria-hidden="true" />
            このプランを共有
          </>
        )}
      </Button>
    </div>
  );
}

export function Results({ initialForm, initialResult, worker, onBack }: ResultsProps) {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(initialResult);
  const [isCalculating, setIsCalculating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const formRef = useRef(form);
  formRef.current = form;

  const prescriptionRef = useRef<HTMLDetailsElement>(null);

  // 処方箋のtop1（最優先アクション表示用）
  const [topPrescription, setTopPrescription] = useState<PrescriptionResult | null>(null);

  // 前回結果との差分
  const PREV_RESULT_KEY = "fire-sanbo-prev-success-rate";
  const [prevDiff] = useState<number | null>(() => {
    try {
      const prev = localStorage.getItem(PREV_RESULT_KEY);
      if (prev === null) return null;
      return Math.round(initialResult.successRate * 100) - Number(prev);
    } catch { return null; }
  });
  // 現在の成功率を保存
  useEffect(() => {
    try {
      localStorage.setItem(PREV_RESULT_KEY, String(Math.round(result.successRate * 100)));
    } catch { /* ignore */ }
  }, [result.successRate]);

  // 適用時の+N%バッジ
  const [applyBadge, setApplyBadge] = useState<string | null>(null);

  // 取り崩し最適化（中央値シナリオ、debounce付きで再計算）
  const [withdrawalResult, setWithdrawalResult] = useState(() =>
    optimizeWithdrawalOrder(formToSimulationInput(form), { deterministic: true })
  );
  const woDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (woDebounceRef.current) clearTimeout(woDebounceRef.current);
    woDebounceRef.current = setTimeout(() => {
      const input = formToSimulationInput(form);
      setWithdrawalResult(optimizeWithdrawalOrder(input, { deterministic: true }));
    }, 400);
    return () => {
      if (woDebounceRef.current) clearTimeout(woDebounceRef.current);
    };
  }, [form]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // 共通の再計算トリガー（debounce 300ms）
  const triggerRecalc = useCallback((showBadge = false) => {
    const prevRate = result.successRate;
    setIsCalculating(true);
    const gen = ++generationRef.current;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const input = formToSimulationInput(formRef.current);
      try {
        const newResult = worker
          ? await worker.run(input)
          : runSimulation(input);
        if (gen !== generationRef.current) return;
        setResult(newResult);
        if (showBadge) {
          const diff = Math.round(newResult.successRate * 100) - Math.round(prevRate * 100);
          if (diff !== 0) {
            setApplyBadge(`${diff > 0 ? "+" : ""}${diff}%`);
            setTimeout(() => setApplyBadge(null), 2000);
          }
        }
      } catch {
        if (gen !== generationRef.current) return;
        setResult(runSimulation(input));
      }
      setIsCalculating(false);
    }, 300);
  }, [worker, result.successRate]);

  const updateAndRecalc = useCallback(
    (key: keyof FormState, value: number) => {
      setForm(prev => {
        const newForm = { ...prev, [key]: value };
        // 依存パラメータの自動補正
        if (key === "retirementAge" && value > newForm.endAge) {
          newForm.endAge = value;
        }
        formRef.current = newForm;
        return newForm;
      });
      triggerRecalc();
    },
    [triggerRecalc]
  );

  const delta = useMemo(() => {
    const pct = Math.round(result.successRate * 100);
    const initialPct = Math.round(initialResult.successRate * 100);
    const diff = pct - initialPct;
    if (diff === 0) return null;
    return diff > 0 ? `+${diff}%` : `${diff}%`;
  }, [result.successRate, initialResult.successRate]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* ━━ 1軍: 常時表示 ━━ */}

      {/* 成功確率 + 最優先アクション */}
      <Card>
        <CardContent className="pt-6 relative">
          {isCalculating && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-lg z-10">
              <p className="text-sm text-muted-foreground animate-pulse">再計算中...</p>
            </div>
          )}
          <SuccessRateDisplay rate={result.successRate} />
          {prevDiff !== null && prevDiff !== 0 && (
            <p className={`text-center text-sm font-medium mt-1 ${prevDiff > 0 ? "text-success" : "text-danger"}`}>
              前回比 {prevDiff > 0 ? "+" : ""}{prevDiff}%
            </p>
          )}
          {applyBadge && (
            <p className="text-center text-sm font-medium text-success mt-1 animate-in fade-in duration-200">
              {applyBadge}
            </p>
          )}
          {topPrescription && !topPrescription.alreadyAchieved && topPrescription.prescriptions.length > 0 && (
            <button
              type="button"
              className="flex items-center gap-2 mx-auto mt-3 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-sm transition-colors"
              onClick={() => {
                if (prescriptionRef.current) {
                  prescriptionRef.current.open = true;
                  prescriptionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            >
              <Lightbulb className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />
              <span>{topPrescription.prescriptions[0].label}</span>
              <span className="text-muted-foreground">→ 詳細を見る▼</span>
            </button>
          )}
          <p className="text-xs text-center text-muted-foreground mt-3">
            🏛️ 2026年度 税制・社会保険料 反映済み ・ インフレ率 {form.inflationRate}% 考慮済み
          </p>
          <ShareButton form={form} />
        </CardContent>
      </Card>

      {/* 資産推移チャート */}
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
                  delta.startsWith("+") ? "text-success" : "text-danger"
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

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>想定インフレ率</Label>
              <span className="text-sm font-medium">
                {form.inflationRate}%
              </span>
            </div>
            <Slider
              value={[form.inflationRate]}
              onValueChange={(v) => updateAndRecalc("inflationRate", Array.isArray(v) ? v[0] : v)}
              min={0}
              max={5}
              step={0.1}
            />
          </div>
        </CardContent>
      </Card>

      {/* 最悪ケース診断書 */}
      <WorstCaseCard result={result} retirementAge={form.retirementAge} />

      {/* ━━ 2軍: アクション（<details>折りたたみ、フラット）━━ */}
      <div>
        <h2 className="text-lg font-semibold mb-1">アクション</h2>
        <hr className="border-border mb-4" />

        <div className="space-y-2">
          {/* 処方箋 */}
          <details className="group" ref={prescriptionRef}>
            <summary className="cursor-pointer list-none flex items-center gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <ChevronRight
                className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
              <span className="font-medium text-sm">処方箋</span>
              <span className="text-xs text-muted-foreground">— 支出削減・退職延期・追加積立の3軸提案</span>
            </summary>
            <div className="pl-6 pb-4">
              <PrescriptionCard
                worker={worker}
                input={formToSimulationInput(form)}
                currentRate={result.successRate}
                onResult={setTopPrescription}
              />
            </div>
          </details>

          {/* 取り崩し最適化 */}
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <ChevronRight
                className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
              <span className="font-medium text-sm">取り崩し戦略</span>
              {withdrawalResult.benefitAmount > 0 && (
                <span className="text-xs text-success font-medium">
                  +{formatManYen(withdrawalResult.benefitAmount)}の改善余地
                </span>
              )}
            </summary>
            <div className="pl-6 pb-4">
              <WithdrawalCard
                result={withdrawalResult}
                currentOrder={formToSimulationInput(form).withdrawalOrder}
                onApply={(order) => {
                  setForm(prev => {
                    const newForm = { ...prev, withdrawalOrder: order };
                    formRef.current = newForm;
                    return newForm;
                  });
                  triggerRecalc(true);
                }}
                isCalculating={isCalculating}
              />
            </div>
          </details>

          {/* 税負担の内訳 */}
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <ChevronRight
                className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
              <span className="font-medium text-sm">アセットアロケーション最適化</span>
            </summary>
            <div className="pl-6 pb-4">
              <PortfolioOptimizer
                currentPortfolio={form.portfolio}
                onApply={(newPortfolio) => {
                  setForm(prev => {
                    const newForm = { ...prev, portfolio: newPortfolio };
                    formRef.current = newForm;
                    return newForm;
                  });
                  triggerRecalc(true);
                }}
              />
            </div>
          </details>

          {/* 税負担の内訳 */}
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <ChevronRight
                className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
              <span className="font-medium text-sm">税負担の内訳</span>
            </summary>
            <div className="pl-6 pb-4">
              <TaxBreakdownCard result={result} retirementAge={form.retirementAge} />
            </div>
          </details>
        </div>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={onBack}>
          入力に戻る
        </Button>
      </div>
    </div>
  );
}
