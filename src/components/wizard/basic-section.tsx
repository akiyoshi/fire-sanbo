import type { FormState } from "@/lib/form-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SliderInput, NumberInput } from "./shared";
import { Zap } from "lucide-react";

interface BasicSectionProps {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onQuickRun?: (form: FormState) => void;
  validationError?: string | null;
}

export function BasicSection({ form, update, onQuickRun, validationError }: BasicSectionProps) {
  const totalAssets = form.portfolio.reduce((s, e) => s + e.amount, 0);
  const isValid = form.currentAge > 0 && (totalAssets > 0 || form.annualSalary > 0) && !validationError;

  return (
    <Card>
      <CardHeader>
        <CardTitle>基本情報</CardTitle>
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
          <SliderInput
            label="退職予定年齢"
            value={form.retirementAge}
            onChange={(v) => update("retirementAge", v)}
            min={form.currentAge + 1}
            max={75}
            step={1}
            suffix="歳"
          />
          <SliderInput
            label="終了年齢"
            value={form.endAge}
            onChange={(v) => update("endAge", v)}
            min={form.retirementAge}
            max={100}
            step={1}
            suffix="歳"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberInput
            label="年収（税引き前）"
            value={form.annualSalary}
            onChange={(v) => update("annualSalary", v)}
            suffix="円"
          />
          <NumberInput
            label="月間生活費"
            value={form.monthlyExpense}
            onChange={(v) => update("monthlyExpense", v)}
            suffix="円/月"
          />
        </div>
        {onQuickRun && (
          <div className="pt-2">
            <Button
              size="lg"
              onClick={() => onQuickRun(form)}
              disabled={!isValid}
              className="gap-1.5 w-full sm:w-auto"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              すぐにシミュレーション
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              資産は下の「資産」セクションで設定します。年金・退職金・ライフイベント等は折りたたみから追加できます。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
