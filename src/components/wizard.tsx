"use client";

import { useState, useMemo, useEffect } from "react";
import type { FormState } from "@/lib/form-state";
import { DEFAULT_FORM, deriveBalancesByTaxCategory, saveForm, loadForm, clearForm } from "@/lib/form-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ASSET_CLASS_IDS, getAssetClassData, calcPortfolio } from "@/lib/portfolio";
import { TAX_CATEGORIES, TAX_CATEGORY_LABELS } from "@/lib/portfolio";
import type { AssetClassId, PortfolioEntry, TaxCategory } from "@/lib/portfolio";

interface WizardProps {
  onComplete: (form: FormState) => void;
}

const SELECTABLE_CLASSES = ASSET_CLASS_IDS.filter((id) => id !== "cash");
const assetClassData = getAssetClassData();

let _inputId = 0;
function useInputId(prefix: string) {
  const [id] = useState(() => `${prefix}-${++_inputId}`);
  return id;
}

function NumberInput({
  label,
  value,
  onChange,
  suffix,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  max?: number;
}) {
  const id = useInputId("num");
  const displayValue = new Intl.NumberFormat("ja-JP").format(value);
  const manYen = value >= 10000 ? `（${Math.round(value / 10000).toLocaleString()}万円）` : "";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          aria-label={label}
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, "");
            const num = Number(raw) || 0;
            const clamped = Math.min(num, max ?? 10_000_000_000);
            onChange(clamped);
          }}
          className="text-right"
        />
        {suffix && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>
      {manYen && (
        <p className="text-xs text-muted-foreground text-right">{manYen}</p>
      )}
    </div>
  );
}

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}) {
  const id = useInputId("slider");
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-sm font-medium">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        id={id}
        aria-label={label}
        value={[value]}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

function formatYen(n: number): string {
  return new Intl.NumberFormat("ja-JP").format(n) + "円";
}

function formatManYen(n: number): string {
  return `${Math.round(n / 10000).toLocaleString()}万`;
}

export function Wizard({ onComplete }: WizardProps) {
  const [form, setForm] = useState<FormState>(() => loadForm() ?? DEFAULT_FORM);

  // FormState変更時にlocalStorageへ自動保存（500msデバウンス）
  useEffect(() => {
    const timer = setTimeout(() => saveForm(form), 500);
    return () => clearTimeout(timer);
  }, [form]);

  const handleReset = () => {
    clearForm();
    setForm(DEFAULT_FORM);
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ポートフォリオ操作
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
        { assetClass: "developed_stock" as AssetClassId, taxCategory: "nisa" as TaxCategory, amount: 0 },
      ],
    }));
  };

  const removeEntry = (index: number) => {
    setForm((prev) => ({
      ...prev,
      portfolio: prev.portfolio.filter((_, i) => i !== index),
    }));
  };

  // 合成計算
  const portfolioResult = useMemo(
    () => calcPortfolio(form.portfolio),
    [form.portfolio]
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

  // 課税種別別残高
  const balances = useMemo(
    () => deriveBalancesByTaxCategory(form.portfolio),
    [form.portfolio]
  );
  const totalBalance = balances.nisa + balances.tokutei + balances.ideco + balances.gold_physical;

  // 金があるか
  const hasGold = form.portfolio.some((e) => e.taxCategory === "gold_physical" && e.amount > 0);

  // バリデーション
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
      {/* 基本情報 */}
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

      {/* 資産 */}
      <Card>
        <CardHeader>
          <CardTitle>資産</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.portfolio.map((entry, i) => (
            <div key={i} className="space-y-1 border-b pb-3 last:border-b-0 last:pb-0">
              {/* 上段: 銘柄名 */}
              <Input
                type="text"
                placeholder="銘柄名（任意）"
                aria-label="銘柄名"
                value={entry.name ?? ""}
                onChange={(e) => updateEntry(i, "name", e.target.value)}
                className="text-xs text-muted-foreground h-7 border-0 px-1 focus-visible:ring-0 shadow-none"
              />
              {/* 下段: 資産クラス / 課税種別 / 金額 / 削除 */}
              <div className="flex items-center gap-2">
                <div className="w-[30%] min-w-0">
                  <select
                    value={entry.assetClass}
                    onChange={(e) => {
                      const newClass = e.target.value as AssetClassId;
                      updateEntry(i, "assetClass", newClass);
                      // 資産クラスに応じて課税種別を自動修正
                      if (newClass === "gold" && entry.taxCategory !== "gold_physical") {
                        updateEntry(i, "taxCategory", "gold_physical");
                      } else if (newClass !== "gold" && entry.taxCategory === "gold_physical") {
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
                <div className="w-[25%] min-w-0">
                  <select
                    value={entry.taxCategory}
                    onChange={(e) => updateEntry(i, "taxCategory", e.target.value)}
                    aria-label="課税種別"
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {entry.assetClass === "gold"
                      ? <option value="gold_physical">{TAX_CATEGORY_LABELS.gold_physical}</option>
                      : TAX_CATEGORIES.filter((tc) => tc !== "gold_physical").map((tc) => (
                          <option key={tc} value={tc}>
                            {TAX_CATEGORY_LABELS[tc]}
                          </option>
                        ))
                    }
                  </select>
                </div>
                <div className="w-[35%] min-w-0">
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
                <div className="w-[10%] flex justify-center">
                  {form.portfolio.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEntry(i)}
                      aria-label="削除"
                      className="text-muted-foreground px-2"
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addEntry}>
            + 行を追加
          </Button>

          {/* 集計パネル */}
          {totalBalance > 0 && (
            <div className="rounded-lg bg-muted p-3 space-y-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {balances.nisa > 0 && <span>NISA <strong>{formatManYen(balances.nisa)}</strong></span>}
                {balances.tokutei > 0 && <span>特定 <strong>{formatManYen(balances.tokutei)}</strong></span>}
                {balances.ideco > 0 && <span>iDeCo <strong>{formatManYen(balances.ideco)}</strong></span>}
                {balances.gold_physical > 0 && <span>金現物 <strong>{formatManYen(balances.gold_physical)}</strong></span>}
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
        </CardContent>
      </Card>

      {/* 詳細設定 */}
      <Card>
        <CardHeader>
          <CardTitle>詳細設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SliderInput
            label="想定インフレ率"
            value={form.inflationRate}
            onChange={(v) => update("inflationRate", v)}
            min={0}
            max={5}
            step={0.1}
            suffix="%"
          />
          <SliderInput
            label="特定口座の含み益率"
            value={form.tokuteiGainRatio}
            onChange={(v) => update("tokuteiGainRatio", v)}
            min={0}
            max={100}
            step={5}
            suffix="%"
          />
          <SliderInput
            label="iDeCoの加入年数"
            value={form.idecoYearsOfService}
            onChange={(v) => update("idecoYearsOfService", v)}
            min={1}
            max={40}
            step={1}
            suffix="年"
          />
          {hasGold && (
            <SliderInput
              label="金の含み益率"
              value={form.goldGainRatio}
              onChange={(v) => update("goldGainRatio", v)}
              min={0}
              max={100}
              step={5}
              suffix="%"
            />
          )}
          <SliderInput
            label="シミュレーション回数"
            value={form.numTrials}
            onChange={(v) => update("numTrials", v)}
            min={100}
            max={10000}
            step={100}
          />
        </CardContent>
      </Card>

      {/* バリデーション + 実行ボタン */}
      {validationError && (
        <p className="text-sm text-destructive text-center">{validationError}</p>
      )}
      <div className="flex justify-center gap-4">
        <Button
          variant="outline"
          onClick={handleReset}
        >
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
  );
}
