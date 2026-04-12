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
        if (next.endAge < next.retirementAge) next.endAge = next.retirementAge;
      }
      if (key === "retirementAge") {
        if (next.endAge < (value as number)) next.endAge = value as number;
      }
      return next;
    });
  };

  // バリデーション
  const balances = useMemo(
    () => deriveBalancesByTaxCategory(form.portfolio),
    [form.portfolio],
  );
  const totalBalance = balances.nisa + balances.tokutei + balances.ideco + balances.gold_physical;
  const hasGold = form.portfolio.some((e) => e.taxCategory === "gold_physical" && e.amount > 0);

  const validate = (): string | null => {
    if (form.retirementAge <= form.currentAge) return "退職年齢は現在の年齢より大きくしてください";
    if (form.endAge < form.retirementAge) return "終了年齢は退職年齢以上にしてください";
    if (form.monthlyExpense <= 0) return "月間生活費を入力してください";
    if (form.portfolio.length === 0) return "資産を1行以上追加してください";
    if (totalBalance <= 0 && form.annualSalary <= 0) return "資産残高または年収を入力してください";
    return null;
  };

  const validationError = validate();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <ScenarioSection
        form={form}
        setForm={setForm}
        activeScenarioId={activeScenarioId}
        setActiveScenarioId={setActiveScenarioId}
      />
      <BasicSection form={form} update={update} />
      <PortfolioSection form={form} setForm={setForm} />
      <IncomeSection form={form} update={update} />
      <EventsSection form={form} update={update} />
      <SpouseSection form={form} update={update} />
      <AdvancedSection form={form} update={update} hasGold={hasGold} />

      {/* 概算プレビュー */}
      <QuickPreview form={form} isValid={!validationError} />

      {/* バリデーション + 実行ボタン */}
      {validationError && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive text-center">{validationError}</p>
      )}
      <div className="flex flex-col items-center gap-3">
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
