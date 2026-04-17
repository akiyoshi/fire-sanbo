import { useState, useEffect, useMemo } from "react";
import type { FormState } from "@/lib/form-state";
import {
  DEFAULT_FORM,
  deriveBalancesByTaxCategory,
  saveForm,
  loadForm,
  clearForm,
} from "@/lib/form-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScenarioSection } from "./wizard/scenario-section";
import { BasicSection } from "./wizard/basic-section";
import { PortfolioSection } from "./wizard/portfolio-section";
import { IncomeSection } from "./wizard/income-section";
import { EventsSection } from "./wizard/events-section";
import { AdvancedSection } from "./wizard/advanced-section";

interface WizardProps {
  onComplete: (form: FormState) => void;
}

export function Wizard({ onComplete }: WizardProps) {
  const [form, setForm] = useState<FormState>(() => loadForm() ?? DEFAULT_FORM);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // FormState変更時にlocalStorageへ自動保存（500msデバウンス）
  useEffect(() => {
    const timer = setTimeout(() => saveForm(form), 500);
    return () => clearTimeout(timer);
  }, [form]);

  const handleReset = () => {
    clearForm();
    setForm(DEFAULT_FORM);
    setActiveScenarioId(null);
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "currentAge") {
        const age = value as number;
        if (next.retirementAge <= age) next.retirementAge = age + 1;
        if (next.endAge <= next.retirementAge) next.endAge = next.retirementAge + 1;
      }
      if (key === "retirementAge") {
        if (next.endAge <= (value as number)) next.endAge = (value as number) + 1;
      }
      return next;
    });
  };

  // バリデーション
  const balances = useMemo(
    () => deriveBalancesByTaxCategory(form.portfolio),
    [form.portfolio],
  );
  const totalBalance = balances.nisa + balances.tokutei + balances.ideco + balances.gold_physical + balances.cash;
  const hasGold = form.portfolio.some((e) => e.taxCategory === "gold_physical" && e.amount > 0);

  const validate = (): string | null => {
    if (form.retirementAge <= form.currentAge) return "退職年齢は現在の年齢より大きくしてください";
    if (form.endAge <= form.retirementAge) return "終了年齢は退職年齢より大きくしてください";
    if (form.monthlyExpense <= 0) return "月間生活費を入力してください";
    if (form.portfolio.length === 0) return "資産を1行以上追加してください";
    if (totalBalance <= 0 && form.annualSalary <= 0) return "資産残高または年収を入力してください";
    if (form.rebalanceEnabled && form.targetAllocation && form.targetAllocation.length > 0) {
      const totalWeight = form.targetAllocation.reduce((s, t) => s + t.weight, 0);
      if (Math.abs(totalWeight - 1.0) >= 0.01) return "目標アロケーションの合計を100%にしてください";
    }
    return null;
  };

  const validationError = validate();

  return (
    <div className="w-full max-w-4xl lg:max-w-6xl mx-auto space-y-6">
      <BasicSection form={form} update={update} onQuickRun={onComplete} validationError={validationError} />
      <PortfolioSection form={form} setForm={setForm} />

      {/* 任意セクション: 折りたたみ（デフォルト閉） */}
      <CollapsibleCard
        title="年金・退職金・副収入"
        badge={(form.pension?.kosei || form.pension?.kokumin || form.retirementBonus?.amount) ? "設定済み" : undefined}
      >
        <IncomeSection form={form} update={update} />
      </CollapsibleCard>

      <CollapsibleCard
        title="ライフイベント"
        badge={(form.lifeEvents?.length ?? 0) > 0 ? `${form.lifeEvents!.length}件` : undefined}
      >
        <EventsSection form={form} update={update} />
      </CollapsibleCard>

      <CollapsibleCard title="詳細設定">
        <AdvancedSection form={form} update={update} hasGold={hasGold} />
      </CollapsibleCard>

      <CollapsibleCard title="シナリオ管理">
        <ScenarioSection
          form={form}
          setForm={setForm}
          activeScenarioId={activeScenarioId}
          setActiveScenarioId={setActiveScenarioId}
        />
      </CollapsibleCard>

      {/* バリデーション + 実行ボタン (スティッキー) */}
      <div className="sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-t">
        {validationError && (
          <p role="alert" aria-live="polite" className="text-sm text-destructive text-center mb-2">{validationError}</p>
        )}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleReset}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            入力をリセット
          </button>
          <Button
            size="lg"
            onClick={() => onComplete(form)}
            disabled={!!validationError}
          >
            シミュレーション開始
          </Button>
        </div>
      </div>
    </div>
  );
}

function CollapsibleCard({ title, badge, children }: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <details className="group">
        <summary className="cursor-pointer list-none">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              <span className="transition-transform group-open:rotate-90" aria-hidden="true">▶</span>
              {title}
              {badge && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{badge}</span>
              )}
            </CardTitle>
          </CardHeader>
        </summary>
        <CardContent className="pt-0">
          {children}
        </CardContent>
      </details>
    </Card>
  );
}
