import { useState } from "react";
import type { OptimizationResult } from "@/lib/withdrawal";
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

export function WithdrawalCard({
  result,
  currentOrder,
  onApply,
  isCalculating,
}: WithdrawalCardProps) {
  const [applied, setApplied] = useState(false);
  const { best, all, benefitAmount } = result;

  const isAlreadyOptimal =
    JSON.stringify(currentOrder) === JSON.stringify(best.order);
  const noImprovement = all.length <= 1 || benefitAmount === 0;

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
