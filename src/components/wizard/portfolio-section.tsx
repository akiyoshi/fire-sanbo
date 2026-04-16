import { useMemo } from "react";
import type { FormState } from "@/lib/form-state";
import { deriveBalancesByTaxCategory } from "@/lib/form-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ASSET_CLASS_IDS, getAssetClassData, calcPortfolio } from "@/lib/portfolio";
import { TAX_CATEGORIES, TAX_CATEGORY_LABELS } from "@/lib/portfolio";
import type { AssetClassId, PortfolioEntry, TaxCategory, TargetAllocation } from "@/lib/portfolio";
import { PortfolioOptimizer } from "@/components/portfolio-optimizer";
import { formatManYen } from "./shared";
import { X } from "lucide-react";

const SELECTABLE_CLASSES = ASSET_CLASS_IDS.filter((id) => id !== "cash");
const TARGET_CLASSES = ASSET_CLASS_IDS.filter((id) => id !== "cash");
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
  const totalBalance = balances.nisa + balances.tokutei + balances.ideco + balances.gold_physical + balances.cash;

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
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <div className="min-w-0 sm:w-[30%]">
                <select
                  value={entry.assetClass}
                  onChange={(e) => {
                    const newClass = e.target.value as AssetClassId;
                    updateEntry(i, "assetClass", newClass);
                    if (newClass === "gold" && entry.taxCategory !== "gold_physical") {
                      updateEntry(i, "taxCategory", "gold_physical");
                    } else if (newClass === "cash" && entry.taxCategory !== "cash") {
                      updateEntry(i, "taxCategory", "cash");
                    } else if (newClass !== "gold" && newClass !== "cash" && (entry.taxCategory === "gold_physical" || entry.taxCategory === "cash")) {
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
              <div className="min-w-0 sm:w-[25%]">
                <select
                  value={entry.taxCategory}
                  onChange={(e) => updateEntry(i, "taxCategory", e.target.value)}
                  aria-label="課税種別"
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {entry.assetClass === "gold"
                    ? <option value="gold_physical">{TAX_CATEGORY_LABELS.gold_physical}</option>
                    : entry.assetClass === "cash"
                    ? <option value="cash">{TAX_CATEGORY_LABELS.cash}</option>
                    : TAX_CATEGORIES.filter((tc) => tc !== "gold_physical" && tc !== "cash").map((tc) => (
                        <option key={tc} value={tc}>
                          {TAX_CATEGORY_LABELS[tc]}
                        </option>
                      ))
                  }
                </select>
              </div>
              <div className="col-span-full sm:col-span-1 sm:w-[35%] min-w-0">
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
              <div className="col-span-full flex justify-end sm:w-[10%] sm:justify-center">
                {form.portfolio.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEntry(i)}
                    aria-label="削除"
                    className="text-muted-foreground px-2 min-h-[44px] min-w-[44px]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
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
              {balances.cash > 0 && <span>現金 <strong>{formatManYen(balances.cash)}</strong></span>}
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
          onApplyTarget={(target) => setForm((prev) => ({
            ...prev,
            targetAllocation: target,
            rebalanceEnabled: true,
          }))}
        />

        {/* 目標アセットアロケーション + リバランス */}
        <TargetAllocationSection form={form} setForm={setForm} />
      </CardContent>
    </Card>
  );
}

function TargetAllocationSection({ form, setForm }: PortfolioSectionProps) {
  const rebalanceEnabled = form.rebalanceEnabled === true;
  const target = form.targetAllocation ?? [];

  const toggleRebalance = () => {
    setForm((prev) => {
      const enabling = !prev.rebalanceEnabled;
      if (enabling && (!prev.targetAllocation || prev.targetAllocation.length === 0)) {
        // ON時に目標未設定 → 現在のportfolioから自動生成
        const portfolioResult = calcPortfolio(prev.portfolio);
        const autoTarget: TargetAllocation[] = TARGET_CLASSES
          .filter((id) => portfolioResult.weights[id] > 0.01)
          .map((id) => ({ assetClass: id, weight: portfolioResult.weights[id] }));
        // 何もなければデフォルト
        const finalTarget = autoTarget.length > 0 ? autoTarget : [
          { assetClass: "developed_stock" as AssetClassId, weight: 0.6 },
          { assetClass: "developed_bond" as AssetClassId, weight: 0.3 },
          { assetClass: "gold" as AssetClassId, weight: 0.1 },
        ];
        return { ...prev, rebalanceEnabled: true, targetAllocation: finalTarget };
      }
      return { ...prev, rebalanceEnabled: enabling };
    });
  };

  const updateWeight = (assetClass: AssetClassId, newWeight: number) => {
    setForm((prev) => {
      const current = prev.targetAllocation ?? [];
      const idx = current.findIndex((t) => t.assetClass === assetClass);
      let updated: TargetAllocation[];
      if (idx >= 0) {
        updated = [...current];
        updated[idx] = { ...updated[idx], weight: newWeight };
      } else {
        updated = [...current, { assetClass, weight: newWeight }];
      }
      return { ...prev, targetAllocation: updated };
    });
  };

  const addAsset = (assetClass: AssetClassId) => {
    setForm((prev) => ({
      ...prev,
      targetAllocation: [...(prev.targetAllocation ?? []), { assetClass, weight: 0.1 }],
    }));
  };

  const removeAsset = (assetClass: AssetClassId) => {
    setForm((prev) => ({
      ...prev,
      targetAllocation: (prev.targetAllocation ?? []).filter((t) => t.assetClass !== assetClass),
    }));
  };

  const totalWeight = target.reduce((s, t) => s + t.weight, 0);
  const usedClasses = new Set(target.map((t) => t.assetClass));
  const availableClasses = TARGET_CLASSES.filter((id) => !usedClasses.has(id));

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">目標アロケーション + リバランス</span>
        <button
          onClick={toggleRebalance}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            rebalanceEnabled ? "bg-primary" : "bg-muted"
          }`}
          role="switch"
          aria-checked={rebalanceEnabled}
          aria-label="リバランス有効化"
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-background transition-transform ${
              rebalanceEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {rebalanceEnabled && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            積立時・退職後に目標配分に近づくようリバランスします。
          </p>

          {target.map((t) => (
            <div key={t.assetClass} className="flex items-center gap-2">
              <span className="w-24 text-xs truncate">{assetClassData[t.assetClass]?.label}</span>
              <div className="flex-1">
                <Slider
                  value={[Math.round(t.weight * 100)]}
                  onValueChange={(v) => updateWeight(t.assetClass, (Array.isArray(v) ? v[0] : v) / 100)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
              <span className="w-10 text-right text-xs font-bold tabular-nums">
                {Math.round(t.weight * 100)}%
              </span>
              <button
                onClick={() => removeAsset(t.assetClass)}
                className="text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={`${assetClassData[t.assetClass]?.label}を削除`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}

          {availableClasses.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {availableClasses.map((id) => (
                <button
                  key={id}
                  onClick={() => addAsset(id)}
                  className="px-2 py-0.5 rounded text-xs border bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  + {assetClassData[id].label}
                </button>
              ))}
            </div>
          )}

          <div className={`text-xs font-medium ${
            Math.abs(totalWeight - 1.0) < 0.01 ? "text-success" : "text-danger"
          }`}>
            合計: {Math.round(totalWeight * 100)}%
            {Math.abs(totalWeight - 1.0) >= 0.01 && " （100%にしてください）"}
          </div>
        </div>
      )}
    </div>
  );
}
