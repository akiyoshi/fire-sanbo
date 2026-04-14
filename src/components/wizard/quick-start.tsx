import { useState } from "react";
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
}

export function QuickStart({ form, update, onQuickRun }: QuickStartProps) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) return null; // フルフォーム表示中は非表示

  const totalAssets = form.portfolio.reduce((s, e) => s + e.amount, 0);
  const isValid = form.currentAge > 0 && (totalAssets > 0 || form.annualSalary > 0);

  const handleQuickRun = () => {
    // 必須フィールドは form に既に反映済み（update経由）
    // 省略フィールドは DEFAULT_FORM のまま
    onQuickRun(form);
  };

  const handleAssetChange = (value: number) => {
    // QuickStartでは先頭のポートフォリオ行の金額を更新
    const newPortfolio: PortfolioEntry[] = form.portfolio.length > 0
      ? form.portfolio.map((e, i) => i === 0 ? { ...e, amount: value } : e)
      : [{ assetClass: "developed_stock", taxCategory: "nisa", amount: value }];
    update("portfolio", newPortfolio);
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
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
            value={totalAssets}
            onChange={handleAssetChange}
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
            onClick={() => setExpanded(true)}
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
