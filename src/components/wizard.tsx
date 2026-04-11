"use client";

import { useState, useMemo } from "react";
import type { FormState } from "@/lib/form-state";
import { DEFAULT_FORM } from "@/lib/form-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ASSET_CLASS_IDS, getAssetClassData, calcPortfolio } from "@/lib/portfolio";
import type { AssetClassId, PortfolioEntry } from "@/lib/portfolio";

interface WizardProps {
  onComplete: (form: FormState) => void;
}

const STEPS = [
  { title: "基本情報", description: "年齢・収入・支出" },
  { title: "口座・資産", description: "NISA・特定口座・iDeCo" },
  { title: "投資条件", description: "リターン・リスク" },
  { title: "確認", description: "入力内容の確認" },
];

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
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
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

const assetClassData = getAssetClassData();
const SELECTABLE_CLASSES = ASSET_CLASS_IDS.filter((id) => id !== "cash");

function PortfolioStep({
  form,
  update,
  setForm,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
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

  const updateEntry = (index: number, field: "assetClass" | "amount", value: AssetClassId | number) => {
    setForm((prev) => {
      const newPortfolio = [...prev.portfolio];
      newPortfolio[index] = { ...newPortfolio[index], [field]: value };
      return { ...prev, portfolio: newPortfolio };
    });
  };

  const addEntry = () => {
    const usedClasses = new Set(form.portfolio.map((e) => e.assetClass));
    const available = SELECTABLE_CLASSES.find((id) => !usedClasses.has(id));
    if (!available) return;
    setForm((prev) => ({
      ...prev,
      portfolio: [...prev.portfolio, { assetClass: available, amount: 0 }],
    }));
  };

  const removeEntry = (index: number) => {
    setForm((prev) => ({
      ...prev,
      portfolio: prev.portfolio.filter((_, i) => i !== index),
    }));
  };

  return (
    <>
      {/* モード切り替え */}
      <div className="flex gap-2">
        <Button
          variant={form.inputMode === "portfolio" ? "default" : "outline"}
          size="sm"
          onClick={() => update("inputMode", "portfolio")}
        >
          ポートフォリオ入力
        </Button>
        <Button
          variant={form.inputMode === "manual" ? "default" : "outline"}
          size="sm"
          onClick={() => update("inputMode", "manual")}
        >
          手動入力
        </Button>
      </div>

      {form.inputMode === "portfolio" ? (
        <>
          <div className="space-y-3">
            {form.portfolio.map((entry, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">資産クラス</Label>
                  <select
                    value={entry.assetClass}
                    onChange={(e) => updateEntry(i, "assetClass", e.target.value as AssetClassId)}
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
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">保有額</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={entry.amount > 0 ? new Intl.NumberFormat("ja-JP").format(entry.amount) : ""}
                    placeholder="0"
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      updateEntry(i, "amount", Math.min(Number(raw) || 0, 10_000_000_000));
                    }}
                    className="text-right"
                  />
                </div>
                {form.portfolio.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEntry(i)}
                    className="text-muted-foreground px-2"
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
          </div>

          {(() => {
            const usedClasses = new Set(form.portfolio.map((e) => e.assetClass));
            return SELECTABLE_CLASSES.some((id) => !usedClasses.has(id));
          })() && (
            <Button variant="outline" size="sm" onClick={addEntry}>
              + 資産クラスを追加
            </Button>
          )}

          {/* 合成値表示 */}
          {portfolioResult.totalAmount > 0 && (
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">📊 合成リターン</span>
                <span className="font-bold tabular-nums">
                  {(portfolioResult.expectedReturn * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">📊 合成リスク</span>
                <span className="font-bold tabular-nums">
                  {(portfolioResult.risk * 100).toFixed(1)}%
                </span>
              </div>
              {diversificationEffect && (
                <p className="text-xs text-muted-foreground">
                  分散効果: {diversificationEffect}%（単純加重比）
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                出典: GPIF基本ポートフォリオ策定資料・各指数過去実績ベースの参考値
              </p>
            </div>
          )}

          <SliderInput
            label="シミュレーション回数"
            value={form.numTrials}
            onChange={(v) => update("numTrials", v)}
            min={100}
            max={10000}
            step={100}
          />
        </>
      ) : (
        <>
          <SliderInput
            label="期待リターン（年率）"
            value={form.expectedReturn}
            onChange={(v) => update("expectedReturn", v)}
            min={0}
            max={15}
            step={0.5}
            suffix="%"
          />
          <SliderInput
            label="標準偏差（リスク）"
            value={form.standardDeviation}
            onChange={(v) => update("standardDeviation", v)}
            min={1}
            max={30}
            step={0.5}
            suffix="%"
          />
          <SliderInput
            label="シミュレーション回数"
            value={form.numTrials}
            onChange={(v) => update("numTrials", v)}
            min={100}
            max={10000}
            step={100}
          />
          <div className="text-xs text-muted-foreground mt-2">
            <p>参考: 全世界株式の過去実績 → リターン約7%、標準偏差約15%</p>
            <p>回数が多いほど精度が上がりますが計算に時間がかかります</p>
          </div>
        </>
      )}
    </>
  );
}

function ConfirmationStep({ form, formatYen }: { form: FormState; formatYen: (n: number) => string }) {
  const portfolioResult = useMemo(
    () => form.inputMode === "portfolio" ? calcPortfolio(form.portfolio) : null,
    [form.inputMode, form.portfolio]
  );

  const effectiveReturn = portfolioResult && portfolioResult.totalAmount > 0
    ? (portfolioResult.expectedReturn * 100).toFixed(1)
    : form.expectedReturn.toString();

  const effectiveRisk = portfolioResult && portfolioResult.totalAmount > 0
    ? (Math.max(0.001, portfolioResult.risk) * 100).toFixed(1)
    : form.standardDeviation.toString();

  return (
    <div className="space-y-3 text-sm">
      <h3 className="font-medium">基本情報</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
        <span>年齢</span>
        <span className="text-foreground">
          {form.currentAge}歳 → {form.retirementAge}歳退職 → {form.endAge}歳まで
        </span>
        <span>年収</span>
        <span className="text-foreground">{formatYen(form.annualSalary)}</span>
        <span>月間支出</span>
        <span className="text-foreground">{formatYen(form.monthlyExpense)}</span>
      </div>

      <h3 className="font-medium mt-4">口座残高</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
        <span>NISA</span>
        <span className="text-foreground">{formatYen(form.nisaBalance)}</span>
        <span>特定口座</span>
        <span className="text-foreground">
          {formatYen(form.tokuteiBalance)}（含み益率 {form.tokuteiGainRatio}%）
        </span>
        <span>iDeCo</span>
        <span className="text-foreground">
          {formatYen(form.idecoBalance)}（加入{form.idecoYearsOfService}年）
        </span>
      </div>

      <h3 className="font-medium mt-4">投資条件</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
        <span>入力モード</span>
        <span className="text-foreground">
          {form.inputMode === "portfolio" ? "ポートフォリオ" : "手動入力"}
        </span>
        {form.inputMode === "portfolio" && portfolioResult && portfolioResult.totalAmount > 0 && (
          <>
            <span>ポートフォリオ合計</span>
            <span className="text-foreground">{formatYen(portfolioResult.totalAmount)}</span>
          </>
        )}
        <span>期待リターン</span>
        <span className="text-foreground">{effectiveReturn}%</span>
        <span>標準偏差</span>
        <span className="text-foreground">{effectiveRisk}%</span>
        <span>試行回数</span>
        <span className="text-foreground">{form.numTrials.toLocaleString()}回</span>
      </div>
    </div>
  );
}

export function Wizard({ onComplete }: WizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): string | null => {
    if (step === 0) {
      if (form.retirementAge <= form.currentAge) return "退職年齢は現在の年齢より大きくしてください";
      if (form.endAge < form.retirementAge) return "終了年齢は退職年齢以上にしてください";
      if (form.monthlyExpense <= 0) return "月間生活費を入力してください";
    }
    if (step === 1) {
      if (form.nisaBalance + form.tokuteiBalance + form.idecoBalance <= 0 && form.annualSalary <= 0) {
        return "口座残高または年収を入力してください";
      }
    }
    return null;
  };

  const validationError = validate();

  const next = () => {
    if (!validationError) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const formatYen = (n: number) =>
    new Intl.NumberFormat("ja-JP").format(n) + "円";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* ステップインジケーター */}
      <nav aria-label="入力ステップ" className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              aria-current={i === step ? "step" : undefined}
              aria-label={`${s.title}${i < step ? "（完了）" : i === step ? "（現在）" : ""}`}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-8 h-0.5 ${
                  i < step ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step].title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {STEPS[step].description}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
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
                label="シミュレーション終了年齢"
                value={form.endAge}
                onChange={(v) => update("endAge", v)}
                min={form.retirementAge}
                max={100}
                step={1}
                suffix="歳"
              />
              <NumberInput
                label="年収（税引き前）"
                value={form.annualSalary}
                onChange={(v) => update("annualSalary", v)}
                suffix="円"
                min={0}
                step={100000}
              />
              <NumberInput
                label="月間生活費"
                value={form.monthlyExpense}
                onChange={(v) => update("monthlyExpense", v)}
                suffix="円/月"
                min={0}
                step={10000}
              />
            </>
          )}

          {step === 1 && (
            <>
              <NumberInput
                label="NISA口座残高"
                value={form.nisaBalance}
                onChange={(v) => update("nisaBalance", v)}
                suffix="円"
                min={0}
                step={100000}
              />
              <NumberInput
                label="特定口座残高"
                value={form.tokuteiBalance}
                onChange={(v) => update("tokuteiBalance", v)}
                suffix="円"
                min={0}
                step={100000}
              />
              <NumberInput
                label="iDeCo残高"
                value={form.idecoBalance}
                onChange={(v) => update("idecoBalance", v)}
                suffix="円"
                min={0}
                step={100000}
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
            </>
          )}

          {step === 2 && (
            <PortfolioStep form={form} update={update} setForm={setForm} />
          )}

          {step === 3 && (
            <ConfirmationStep form={form} formatYen={formatYen} />
          )}
        </CardContent>
      </Card>

      {/* ナビゲーション */}
      {validationError && (
        <p className="text-sm text-destructive text-center">{validationError}</p>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={prev} disabled={step === 0}>
          戻る
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={!!validationError}>次へ</Button>
        ) : (
          <Button onClick={() => onComplete(form)}>シミュレーション開始</Button>
        )}
      </div>
    </div>
  );
}
