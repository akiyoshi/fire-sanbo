import type { FormState, SpouseFormState } from "@/lib/form-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ASSET_CLASS_IDS, getAssetClassData } from "@/lib/portfolio";
import { TAX_CATEGORIES, TAX_CATEGORY_LABELS } from "@/lib/portfolio";
import type { AssetClassId, TaxCategory } from "@/lib/portfolio";
import { NumberInput, SliderInput } from "./shared";

const SELECTABLE_CLASSES = ASSET_CLASS_IDS.filter((id) => id !== "cash");
const assetClassData = getAssetClassData();

const DEFAULT_SPOUSE: SpouseFormState = {
  currentAge: 33,
  retirementAge: 55,
  annualSalary: 4_000_000,
  portfolio: [{ id: "spouse-default-1", assetClass: "developed_stock" as const, taxCategory: "nisa" as const, amount: 0 }],
  idecoYearsOfService: 10,
  tokuteiGainRatio: 50,
  goldGainRatio: 30,
  pension: { kosei: 80_000, kokumin: 65_000, startAge: 65 },
  retirementBonus: { amount: 0, yearsOfService: 15 },
  nisaConfig: { annualLimit: 3_600_000, lifetimeLimit: 18_000_000 },
};

interface SpouseSectionProps {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

export function SpouseSection({ form, update }: SpouseSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>配偶者</span>
          <Button
            variant={form.spouseEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (form.spouseEnabled) {
                // OFF: データは保持、フラグだけ切り替え
                update("spouseEnabled", false);
              } else {
                // ON: 既存データがあればそのまま、なければデフォルト生成
                if (!form.spouse) {
                  update("spouse", { ...DEFAULT_SPOUSE, currentAge: form.currentAge - 2 });
                }
                update("spouseEnabled", true);
              }
            }}
          >
            {form.spouseEnabled ? "配偶者あり" : "配偶者を追加"}
          </Button>
        </CardTitle>
      </CardHeader>
      {form.spouse && form.spouseEnabled && (
        <CardContent className="space-y-4">
          {/* 基本情報 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SliderInput
              label="配偶者の年齢"
              value={form.spouse.currentAge}
              onChange={(v) => update("spouse", { ...form.spouse!, currentAge: v })}
              min={20}
              max={70}
              step={1}
              suffix="歳"
            />
            <SliderInput
              label="配偶者の退職年齢"
              value={form.spouse.retirementAge}
              onChange={(v) => update("spouse", { ...form.spouse!, retirementAge: v })}
              min={form.spouse.currentAge + 1}
              max={75}
              step={1}
              suffix="歳"
            />
            <NumberInput
              label="配偶者の年収"
              value={form.spouse.annualSalary}
              onChange={(v) => update("spouse", { ...form.spouse!, annualSalary: v })}
              suffix="円"
            />
          </div>

          {/* 配偶者の資産 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">配偶者の資産</h3>
            {form.spouse.portfolio.map((entry, i) => (
              <div key={entry.id ?? i} className="flex items-center gap-2">
                <div className="w-[35%] min-w-0">
                  <select
                    value={entry.assetClass}
                    onChange={(e) => {
                      const portfolio = [...form.spouse!.portfolio];
                      portfolio[i] = { ...portfolio[i], assetClass: e.target.value as AssetClassId };
                      update("spouse", { ...form.spouse!, portfolio });
                    }}
                    aria-label="資産クラス"
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {SELECTABLE_CLASSES.map((id) => (
                      <option key={id} value={id}>{assetClassData[id].label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-[25%] min-w-0">
                  <select
                    value={entry.taxCategory}
                    onChange={(e) => {
                      const portfolio = [...form.spouse!.portfolio];
                      portfolio[i] = { ...portfolio[i], taxCategory: e.target.value as TaxCategory };
                      update("spouse", { ...form.spouse!, portfolio });
                    }}
                    aria-label="課税種別"
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {TAX_CATEGORIES.filter((tc) => tc !== "gold_physical").map((tc) => (
                      <option key={tc} value={tc}>{TAX_CATEGORY_LABELS[tc]}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <Input
                    type="text"
                    inputMode="numeric"
                    aria-label="保有額"
                    value={entry.amount > 0 ? new Intl.NumberFormat("ja-JP").format(entry.amount) : ""}
                    placeholder="0"
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      const portfolio = [...form.spouse!.portfolio];
                      portfolio[i] = { ...portfolio[i], amount: Math.min(Number(raw) || 0, 10_000_000_000) };
                      update("spouse", { ...form.spouse!, portfolio });
                    }}
                    className="text-right font-bold tabular-nums"
                  />
                </div>
                {form.spouse!.portfolio.length > 1 && (
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => {
                      const portfolio = form.spouse!.portfolio.filter((_, idx) => idx !== i);
                      update("spouse", { ...form.spouse!, portfolio });
                    }}
                    aria-label="削除" className="text-muted-foreground px-2"
                  >✕</Button>
                )}
              </div>
            ))}
            <Button
              variant="outline" size="sm"
              onClick={() => {
                const portfolio = [...form.spouse!.portfolio, { id: crypto.randomUUID(), assetClass: "developed_stock" as AssetClassId, taxCategory: "nisa" as TaxCategory, amount: 0 }];
                update("spouse", { ...form.spouse!, portfolio });
              }}
            >+ 行を追加</Button>
          </div>

          {/* 配偶者の年金 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">配偶者の年金</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumberInput
                label="厚生年金（月額）"
                value={form.spouse.pension?.kosei ?? 0}
                onChange={(v) => update("spouse", { ...form.spouse!, pension: { ...(form.spouse!.pension ?? { kosei: 0, kokumin: 65000, startAge: 65 }), kosei: v } })}
                suffix="円/月"
              />
              <NumberInput
                label="国民年金（月額）"
                value={form.spouse.pension?.kokumin ?? 0}
                onChange={(v) => update("spouse", { ...form.spouse!, pension: { ...(form.spouse!.pension ?? { kosei: 0, kokumin: 0, startAge: 65 }), kokumin: v } })}
                suffix="円/月"
              />
              <SliderInput
                label="受給開始年齢"
                value={form.spouse.pension?.startAge ?? 65}
                onChange={(v) => update("spouse", { ...form.spouse!, pension: { ...(form.spouse!.pension ?? { kosei: 0, kokumin: 65000, startAge: 65 }), startAge: v } })}
                min={60} max={75} step={1} suffix="歳"
              />
            </div>
          </div>

          {/* 配偶者の退職金 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">配偶者の退職金</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberInput
                label="退職金見込み額"
                value={form.spouse.retirementBonus?.amount ?? 0}
                onChange={(v) => update("spouse", { ...form.spouse!, retirementBonus: { ...(form.spouse!.retirementBonus ?? { amount: 0, yearsOfService: 15 }), amount: v } })}
                suffix="円"
              />
              <SliderInput
                label="勤続年数"
                value={form.spouse.retirementBonus?.yearsOfService ?? 15}
                onChange={(v) => update("spouse", { ...form.spouse!, retirementBonus: { ...(form.spouse!.retirementBonus ?? { amount: 0, yearsOfService: 15 }), yearsOfService: v } })}
                min={1} max={45} step={1} suffix="年"
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
