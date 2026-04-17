import { useEffect, useRef, useState } from "react";
import type { FormState } from "@/lib/form-state";
import { DEFAULT_FORM } from "@/lib/form-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SliderInput, NumberInput } from "./shared";
import { Zap } from "lucide-react";
import type { PortfolioEntry } from "@/lib/portfolio";

interface QuickStartProps {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onQuickRun: (form: FormState) => void;
  validationError?: string | null;
}

export function QuickStart({ form, update, onQuickRun, validationError }: QuickStartProps) {
  const [expanded, setExpanded] = useState(false);
  const totalAssets = form.portfolio.reduce((s, e) => s + e.amount, 0);
  const [assetDraft, setAssetDraft] = useState(totalAssets);
  const previousWeightsRef = useRef<number[]>([]);
  const isValid = form.currentAge > 0 && (assetDraft > 0 || form.annualSalary > 0) && !validationError;

  useEffect(() => {
    if (form.portfolio.length === 0 || totalAssets <= 0) return;
    previousWeightsRef.current = form.portfolio.map((entry) => entry.amount / totalAssets);
  }, [form.portfolio, totalAssets]);

  useEffect(() => {
    setAssetDraft(totalAssets);
  }, [totalAssets]);

  if (expanded) return null; // フルフォーム表示中は非表示

  const buildPortfolioWithTotal = (value: number): PortfolioEntry[] => {
    // QuickStart の総資産入力は、既存の配分比率を保ったまま合計額を更新する
    return form.portfolio.length > 0
      ? (() => {
          const currentTotal = form.portfolio.reduce((sum, entry) => sum + entry.amount, 0);

          if (value <= 0) {
            return form.portfolio.map((entry) => ({ ...entry, amount: 0 }));
          }

          if (currentTotal <= 0) {
            const fallbackWeights = previousWeightsRef.current.length === form.portfolio.length
              ? previousWeightsRef.current
              : form.portfolio.map((_, index) => (index === 0 ? 1 : 0));

            let remaining = value;
            return form.portfolio.map((entry, index) => {
              if (index === form.portfolio.length - 1) {
                return { ...entry, amount: remaining };
              }

              const scaledAmount = Math.floor(Math.max(fallbackWeights[index] ?? 0, 0) * value);
              remaining -= scaledAmount;
              return { ...entry, amount: scaledAmount };
            });
          }

          let remaining = value;
          return form.portfolio.map((entry, index) => {
            if (index === form.portfolio.length - 1) {
              return { ...entry, amount: remaining };
            }

            const scaledAmount = Math.floor((entry.amount / currentTotal) * value);
            remaining -= scaledAmount;
            return { ...entry, amount: scaledAmount };
          });
        })()
      : [{ assetClass: "developed_stock", taxCategory: "nisa", amount: value }];
  };

  const commitAssetDraft = (): FormState => {
    const nextPortfolio = buildPortfolioWithTotal(assetDraft);
    const nextForm = { ...form, portfolio: nextPortfolio };
    update("portfolio", nextPortfolio);
    return nextForm;
  };

  const handleQuickRun = () => {
    // 必須フィールドは form に既に反映済み（update経由）
    // 総資産のドラフトは実行時に portfolio へ反映する
    onQuickRun(commitAssetDraft());
  };

  return (
    <Card role="region" aria-label="クイックスタート" className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
          まずは3項目で試してみる
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SliderInput
            label="現在の年齢"
            value={form.currentAge}
            onChange={(v) => update("currentAge", v)}
            min={20}
            max={70}
            step={1}
            suffix="歳"
          />
          <NumberInput
            label="年収（税引き前）"
            value={form.annualSalary}
            onChange={(v) => update("annualSalary", v)}
            suffix="円"
          />
          <NumberInput
            label="現在の資産総額"
            value={assetDraft}
            onChange={setAssetDraft}
            suffix="円"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="lg"
            onClick={handleQuickRun}
            disabled={!isValid}
            className="gap-1.5"
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            すぐにシミュレーション
          </Button>
          <button
            onClick={() => {
              commitAssetDraft();
              setExpanded(true);
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            詳しく設定する ↓
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          退職年齢{DEFAULT_FORM.retirementAge}歳・月間生活費{(DEFAULT_FORM.monthlyExpense / 10000).toFixed(0)}万円・インフレ率{DEFAULT_FORM.inflationRate}%で概算します。下の詳細フォームで変更できます。
        </p>
      </CardContent>
    </Card>
  );
}
