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
import { ScenarioSection } from "./wizard/scenario-section";
import { BasicSection } from "./wizard/basic-section";
import { PortfolioSection } from "./wizard/portfolio-section";
import { IncomeSection } from "./wizard/income-section";
import { EventsSection } from "./wizard/events-section";
import { SpouseSection } from "./wizard/spouse-section";
import { AdvancedSection } from "./wizard/advanced-section";
import { QuickPreview } from "./wizard/quick-preview";

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
      // 年齢スライダーのカスケード: 上流を動かしたら下流もクランプ
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
    return null;
  };

  const validationError = validate();

  return (
    <div className="w-full max-w-4xl lg:max-w-6xl mx-auto space-y-6">
      <ScenarioSection
        form={form}
        setForm={setForm}
        activeScenarioId={activeScenarioId}
        setActiveScenarioId={setActiveScenarioId}
      />
      <BasicSection form={form} update={update} />
      <PortfolioSection form={form} setForm={setForm} />

      {/* 任意セクション: 折りたたみ */}
      <details className="group" open={!!form.pension?.kosei || !!form.pension?.kokumin || !!form.retirementBonus?.amount}>
        <summary className="cursor-pointer list-none">
          <div className="flex items-center gap-2 px-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <span className="transition-transform group-open:rotate-90" aria-hidden="true">▶</span>
            年金・退職金・副収入
            {(form.pension?.kosei || form.pension?.kokumin || form.retirementBonus?.amount) && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">設定済み</span>
            )}
          </div>
        </summary>
        <IncomeSection form={form} update={update} />
      </details>

      <details className="group" open={(form.lifeEvents?.length ?? 0) > 0}>
        <summary className="cursor-pointer list-none">
          <div className="flex items-center gap-2 px-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <span className="transition-transform group-open:rotate-90" aria-hidden="true">▶</span>
            ライフイベント
            {(form.lifeEvents?.length ?? 0) > 0 && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{form.lifeEvents!.length}件</span>
            )}
          </div>
        </summary>
        <EventsSection form={form} update={update} />
      </details>

      {/* 配偶者セクション: 現在独身のため非表示（将来復活予定）
      <details className="group" open={!!form.spouseEnabled}>
        <summary className="cursor-pointer list-none">
          <div className="flex items-center gap-2 px-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <span className="transition-transform group-open:rotate-90">▶</span>
            配偶者
            {form.spouseEnabled && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">設定済み</span>
            )}
          </div>
        </summary>
        <SpouseSection form={form} update={update} />
      </details>
      */}

      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center gap-2 px-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <span className="transition-transform group-open:rotate-90" aria-hidden="true">▶</span>
            詳細設定
          </div>
        </summary>
        <AdvancedSection form={form} update={update} hasGold={hasGold} />
      </details>

      {/* 概算プレビュー */}
      <QuickPreview form={form} isValid={!validationError} />

      {/* バリデーション + 実行ボタン (スティッキー) */}
      <div className="sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-t">
        {validationError && (
          <p role="alert" aria-live="polite" className="text-sm text-destructive text-center mb-2">{validationError}</p>
        )}
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={handleReset}>
            入力をリセット
          </Button>
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
