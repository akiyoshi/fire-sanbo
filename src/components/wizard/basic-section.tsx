import type { FormState } from "@/lib/form-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SliderInput, NumberInput } from "./shared";

interface BasicSectionProps {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

export function BasicSection({ form, update }: BasicSectionProps) {
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
      </CardContent>
    </Card>
  );
}
