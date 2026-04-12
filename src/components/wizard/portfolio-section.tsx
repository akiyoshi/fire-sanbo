import { useMemo } from "react";
import type { FormState } from "@/lib/form-state";
import { deriveBalancesByTaxCategory } from "@/lib/form-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ASSET_CLASS_IDS, getAssetClassData, calcPortfolio } from "@/lib/portfolio";
import { TAX_CATEGORIES, TAX_CATEGORY_LABELS } from "@/lib/portfolio";
import type { AssetClassId, PortfolioEntry, TaxCategory } from "@/lib/portfolio";
import { PortfolioOptimizer } from "@/components/portfolio-optimizer";
import { formatManYen } from "./shared";

const SELECTABLE_CLASSES = ASSET_CLASS_IDS.filter((id) => id !== "cash");
const assetClassData = getAssetClassData();

interface PortfolioSectionProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}

export function PortfolioSection({ form, setForm }: PortfolioSectionProps) {
  const updateEntry = (index: number, field: keyof PortfolioEntry, value: string | number) => {
    setForm((prev) => {
      const newPortfolio = [...prev.portfolio];
      newPortfolio[index] = { ...newPortfolio[index], [field]: value };
      return { ...prev, portfolio: newPortfolio };
    });
  };

  const addEntry = () => {
    setForm((prev) => ({
      ...prev,
      portfolio: [
        ...prev.portfolio,
        { id: crypto.randomUUID(), assetClass: "developed_stock" as AssetClassId, taxCategory: "nisa" as TaxCategory, amount: 0 },
      ],
    }));
  };

  const removeEntry = (index: number) => {
    setForm((prev) => ({
      ...prev,
      portfolio: prev.portfolio.filter((_, i) => i !== index),
    }));
  };

  const portfolioResult = useMemo(
    () => calcPortfolio(form.portfolio),
    [form.portfolio],
  );

  const simpleAvgRisk = useMemo(() => {
    const total = form.portfolio.reduce((s, e) => s + e.amount, 0);
    if (total === 0) return 0;
    return form.portfolio.reduce((s, e) => {
      const w = e.amount / total;
      return s + w * (assetClassData[e.assetClass]?.risk ?? 0);
    }, 0);
  }, [form.portfolio]);

  const diversificationEffect =
    portfolioResult.totalAmount > 0 && simpleAvgRisk > 0
      ? ((portfolioResult.risk - simpleAvgRisk) * 100).toFixed(1)
      : null;

  const balances = useMemo(
    () => deriveBalancesByTaxCategory(form.portfolio),
    [form.portfolio],
  );
  const totalBalance = balances.nisa + balances.tokutei + balances.ideco + balances.gold_physical;

  return (
    <Card>
      <CardHeader>
        <CardTitle>資産</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {form.portfolio.map((entry, i) => (
          <div key={entry.id ?? i} className="space-y-1 border-b pb-3 last:border-b-0 last:pb-0">
            <Input
              type="text"
              placeholder="銘柄名（任意）"
              aria-label="銘柄名"
              value={entry.name ?? ""}
              onChange={(e) => updateEntry(i, "name", e.target.value)}
              className="text-xs text-muted-foreground h-7 border-0 px-1 focus-visible:ring-0 shadow-none"
            />
            <div className="flex items-center gap-2">
              <div className="w-[30%] min-w-0">
                <select
                  value={entry.assetClass}
                  onChange={(e) => {
                    const newClass = e.target.value as AssetClassId;
                    updateEntry(i, "assetClass", newClass);
                    if (newClass === "gold" && entry.taxCategory !== "gold_physical") {
                      updateEntry(i, "taxCategory", "gold_physical");
                    } else if (newClass !== "gold" && entry.taxCategory === "gold_physical") {
                      updateEntry(i, "taxCategory", "tokutei");
                    }
                  }}
                  aria-label="資産クラス"
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {SELECTABLE_CLASSES.map((id) => (
                    <option key={id} value={id}>
                      {assetClassData[id].label}
                    </option>
                  ))}
                  <option value="cash">{assetClassData.cash.label}</option>
                </select>
              </div>
              <div className="w-[25%] min-w-0">
                <select
                  value={entry.taxCategory}
                  onChange={(e) => updateEntry(i, "taxCategory", e.target.value)}
                  aria-label="課税種別"
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {entry.assetClass === "gold"
                    ? <option value="gold_physical">{TAX_CATEGORY_LABELS.gold_physical}</option>
                    : TAX_CATEGORIES.filter((tc) => tc !== "gold_physical").map((tc) => (
                        <option key={tc} value={tc}>
                          {TAX_CATEGORY_LABELS[tc]}
                        </option>
                      ))
                  }
                </select>
              </div>
              <div className="w-[35%] min-w-0">
                <Input
                  type="text"
                  inputMode="numeric"
                  aria-label="保有額"
                  value={entry.amount > 0 ? new Intl.NumberFormat("ja-JP").format(entry.amount) : ""}
                  placeholder="0"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    updateEntry(i, "amount", Math.min(Number(raw) || 0, 10_000_000_000));
                  }}
                  className="text-right font-bold tabular-nums"
                />
              </div>
              <div className="w-[10%] flex justify-center">
                {form.portfolio.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEntry(i)}
                    aria-label="削除"
                    className="text-muted-foreground px-2"
                  >
                    ✕
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={addEntry}>
          + 行を追加
        </Button>

        {totalBalance > 0 && (
          <div className="rounded-lg bg-muted p-3 space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {balances.nisa > 0 && <span>NISA <strong>{formatManYen(balances.nisa)}</strong></span>}
              {balances.tokutei > 0 && <span>特定 <strong>{formatManYen(balances.tokutei)}</strong></span>}
              {balances.ideco > 0 && <span>iDeCo <strong>{formatManYen(balances.ideco)}</strong></span>}
              {balances.gold_physical > 0 && <span>金現物 <strong>{formatManYen(balances.gold_physical)}</strong></span>}
              <span className="font-medium">合計 <strong>{formatManYen(totalBalance)}</strong></span>
            </div>
            {portfolioResult.totalAmount > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">合成リターン</span>
                  <span className="font-bold tabular-nums">
                    {(portfolioResult.expectedReturn * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">合成リスク</span>
                  <span className="font-bold tabular-nums">
                    {(portfolioResult.risk * 100).toFixed(1)}%
                  </span>
                </div>
                {diversificationEffect && (
                  <p className="text-xs text-muted-foreground">
                    分散効果: {diversificationEffect}%（単純加重比）
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  出典: GPIF基本ポートフォリオ策定資料・各指数過去実績ベースの参考値
                </p>
              </>
            )}
          </div>
        )}

        <PortfolioOptimizer
          currentPortfolio={form.portfolio}
          onApply={(newPortfolio) => setForm((prev) => ({ ...prev, portfolio: newPortfolio }))}
        />
      </CardContent>
    </Card>
  );
}
