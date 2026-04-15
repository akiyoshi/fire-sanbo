import { useState, useMemo } from "react";
import type { OptimizationResult, WithdrawalOrderResult } from "@/lib/withdrawal";
import type { TaxCategory } from "@/lib/tax";
import { formatManYen } from "@/lib/utils";
import { ArrowRight, Check, ChevronRight } from "lucide-react";

const CATEGORY_NAME: Record<TaxCategory, string> = {
  nisa: "NISA",
  tokutei: "特定",
  ideco: "iDeCo",
  gold_physical: "金現物",
  cash: "現金",
};

function OrderDisplay({ order }: { order: TaxCategory[] }) {
  return (
    <span className="font-medium">
      {order.map((c, i) => (
        <span key={c}>
          {i > 0 && (
            <ArrowRight
              className="inline h-3 w-3 mx-1 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          {CATEGORY_NAME[c]}
        </span>
      ))}
    </span>
  );
}

interface WithdrawalCardProps {
  result: OptimizationResult;
  currentOrder: TaxCategory[];
  onApply: (order: TaxCategory[]) => void;
  isCalculating: boolean;
}

function StrategyChart({ best, worst, currentResult }: {
  best: WithdrawalOrderResult;
  worst: WithdrawalOrderResult;
  currentResult: WithdrawalOrderResult | undefined;
}) {
  const lines = useMemo(() => {
    const entries: { data: WithdrawalOrderResult; color: string; dash: string; label: string }[] = [
      { data: best, color: "var(--color-success)", dash: "", label: "最適" },
    ];
    if (currentResult && JSON.stringify(currentResult.order) !== JSON.stringify(best.order)) {
      entries.push({ data: currentResult, color: "var(--color-warning)", dash: "6 3", label: "現在" });
    }
    if (JSON.stringify(worst.order) !== JSON.stringify(best.order)) {
      entries.push({ data: worst, color: "var(--color-danger)", dash: "3 3", label: "最悪" });
    }
    return entries;
  }, [best, worst, currentResult]);

  if (!best.yearlyAssets || !best.ages) return null;

  const ages = best.ages;
  const allValues = lines.flatMap((l) => l.data.yearlyAssets ?? []);
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  const W = 320;
  const H = 140;
  const PAD_L = 50;
  const PAD_R = 10;
  const PAD_T = 10;
  const PAD_B = 25;

  const toX = (i: number) => PAD_L + (i / Math.max(ages.length - 1, 1)) * (W - PAD_L - PAD_R);
  const toY = (v: number) => PAD_T + (1 - (v - minVal) / range) * (H - PAD_T - PAD_B);

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">資産推移の比較（中央値シナリオ）</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="取り崩し戦略別の資産推移比較グラフ">
        {/* Grid */}
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="currentColor" strokeOpacity={0.15} />
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="currentColor" strokeOpacity={0.15} />
        {/* Y labels */}
        <text x={PAD_L - 4} y={PAD_T + 4} textAnchor="end" fontSize={8} fill="currentColor" opacity={0.5}>{formatManYen(maxVal)}</text>
        <text x={PAD_L - 4} y={H - PAD_B} textAnchor="end" fontSize={8} fill="currentColor" opacity={0.5}>{formatManYen(minVal)}</text>
        {/* X labels */}
        <text x={PAD_L} y={H - 4} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>{ages[0]}歳</text>
        <text x={W - PAD_R} y={H - 4} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>{ages[ages.length - 1]}歳</text>
        {/* Lines */}
        {lines.map((line) => {
          const assets = line.data.yearlyAssets;
          if (!assets) return null;
          const points = assets.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
          return (
            <polyline
              key={line.label}
              points={points}
              fill="none"
              stroke={line.color}
              strokeWidth={line.dash ? 1.5 : 2}
              strokeDasharray={line.dash}
              strokeOpacity={line.dash ? 0.7 : 1}
            />
          );
        })}
      </svg>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        {lines.map((line) => (
          <span key={line.label} className="flex items-center gap-1">
            <span
              className="inline-block w-4 h-0.5"
              style={{
                background: line.color,
                borderTop: line.dash ? `1.5px dashed ${line.color}` : `2px solid ${line.color}`,
                height: 0,
              }}
            />
            <svg width="16" height="4" className="shrink-0">
              <line x1="0" y1="2" x2="16" y2="2"
                stroke={line.color}
                strokeWidth={line.dash ? 1.5 : 2}
                strokeDasharray={line.dash}
              />
            </svg>
            {line.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function WithdrawalCard({
  result,
  currentOrder,
  onApply,
  isCalculating,
}: WithdrawalCardProps) {
  const [applied, setApplied] = useState(false);
  const { best, all, benefitAmount } = result;
  const worst = all[all.length - 1];

  const isAlreadyOptimal =
    JSON.stringify(currentOrder) === JSON.stringify(best.order);
  const noImprovement = all.length <= 1 || benefitAmount === 0;

  // 現在の順序に対応する結果を検索
  const currentResult = all.find(
    (r) => JSON.stringify(r.order) === JSON.stringify(currentOrder)
  );

  const handleApply = () => {
    onApply(best.order);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  if (noImprovement) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">
          {all.length <= 1
            ? "最適化対象の口座がありません"
            : "取り崩し順序の変更による改善はありません"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">現在の順序</span>
          <OrderDisplay order={currentOrder} />
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">最適な順序</span>
          <OrderDisplay order={best.order} />
        </div>
      </div>

      <div className="rounded-lg border bg-success/5 p-3 text-sm">
        <p>
          効果: 最終資産{" "}
          <span className="font-bold text-success">
            +{formatManYen(benefitAmount)}
          </span>
          <span className="text-muted-foreground ml-1">
            （最適 vs 最悪順序の差）
          </span>
        </p>
      </div>

      {!isAlreadyOptimal && (
        <button
          onClick={handleApply}
          disabled={isCalculating || applied}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {applied ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              適用しました
            </>
          ) : (
            "最適順序を適用"
          )}
        </button>
      )}

      {isAlreadyOptimal && (
        <p className="text-sm text-success font-medium">
          現在の順序が最適です
        </p>
      )}

      {/* 戦略比較グラフ */}
      {best.yearlyAssets && (
        <StrategyChart best={best} worst={worst} currentResult={currentResult} />
      )}

      <details className="group">
        <summary className="cursor-pointer list-none flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronRight
            className="h-4 w-4 transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
          全{all.length}パターンの順位表
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">取り崩し順序の全パターン比較</caption>
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="py-1.5 pr-2 font-medium">#</th>
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  順序
                </th>
                <th
                  scope="col"
                  className="py-1.5 text-right font-medium tabular-nums"
                >
                  最終資産
                </th>
              </tr>
            </thead>
            <tbody>
              {all.map((r, i) => (
                <tr
                  key={r.label}
                  className={
                    i === 0
                      ? "bg-success/10 font-medium"
                      : i === all.length - 1
                        ? "bg-danger/5"
                        : ""
                  }
                >
                  <td className="py-1 pr-2 tabular-nums">{i + 1}</td>
                  <td className="py-1 pr-2">{r.label}</td>
                  <td className="py-1 text-right tabular-nums">
                    {formatManYen(r.medianFinalAssets)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
