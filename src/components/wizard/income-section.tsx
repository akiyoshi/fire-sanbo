import type { FormState } from "@/lib/form-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberInput, SliderInput } from "./shared";

interface IncomeSectionProps {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

const DEFAULT_PENSION = { kosei: 0, kokumin: 65_000, startAge: 65 };

export function IncomeSection({ form, update }: IncomeSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>年金・退職金・副収入</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 年金 */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">公的年金</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput
              label="厚生年金（月額）"
              value={form.pension?.kosei ?? 0}
              onChange={(v) =>
                update("pension", { ...(form.pension ?? DEFAULT_PENSION), kosei: v })
              }
              suffix="円/月"
            />
            <NumberInput
              label="国民年金（月額）"
              value={form.pension?.kokumin ?? 0}
              onChange={(v) =>
                update("pension", { ...(form.pension ?? DEFAULT_PENSION), kokumin: v })
              }
              suffix="円/月"
            />
            <SliderInput
              label="受給開始年齢"
              value={form.pension?.startAge ?? 65}
              onChange={(v) =>
                update("pension", { ...(form.pension ?? DEFAULT_PENSION), startAge: v })
              }
              min={60}
              max={75}
              step={1}
              suffix="歳"
            />
          </div>
          {form.pension && form.pension.startAge !== 65 && (
            <p className="text-xs text-muted-foreground">
              {form.pension.startAge < 65
                ? `繰上げ: ${((65 - form.pension.startAge) * 12 * 0.4).toFixed(1)}% 減額`
                : `繰下げ: ${((form.pension.startAge - 65) * 12 * 0.7).toFixed(1)}% 増額`
              }
            </p>
          )}
        </div>

        {/* 退職金 */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">退職金</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberInput
              label="退職金見込み額"
              value={form.retirementBonus?.amount ?? 0}
              onChange={(v) =>
                update("retirementBonus", { ...(form.retirementBonus ?? { amount: 0, yearsOfService: 20 }), amount: v })
              }
              suffix="円"
            />
            <SliderInput
              label="勤続年数"
              value={form.retirementBonus?.yearsOfService ?? 20}
              onChange={(v) =>
                update("retirementBonus", { ...(form.retirementBonus ?? { amount: 0, yearsOfService: 20 }), yearsOfService: v })
              }
              min={1}
              max={45}
              step={1}
              suffix="年"
            />
          </div>
        </div>

        {/* 副収入 */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">退職後の副収入（サイドFIRE）</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberInput
              label="年間副収入（税引前）"
              value={form.sideIncome?.annualAmount ?? 0}
              onChange={(v) => {
                if (v > 0) {
                  update("sideIncome", { annualAmount: v, untilAge: form.sideIncome?.untilAge ?? 65 });
                } else {
                  update("sideIncome", undefined);
                }
              }}
              suffix="円/年"
            />
            {form.sideIncome && form.sideIncome.annualAmount > 0 && (
              <SliderInput
                label="副収入の継続年齢"
                value={form.sideIncome.untilAge}
                onChange={(v) =>
                  update("sideIncome", { ...form.sideIncome!, untilAge: v })
                }
                min={form.retirementAge}
                max={80}
                step={1}
                suffix="歳まで"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
