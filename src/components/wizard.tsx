"use client";

import { useState } from "react";
import type { FormState } from "@/lib/form-state";
import { DEFAULT_FORM } from "@/lib/form-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface WizardProps {
  onComplete: (form: FormState) => void;
}

const STEPS = [
  { title: "基本情報", description: "年齢・収入・支出" },
  { title: "口座・資産", description: "NISA・特定口座・iDeCo" },
  { title: "投資条件", description: "リターン・リスク" },
  { title: "確認", description: "入力内容の確認" },
];

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
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className="text-right"
        />
        {suffix && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>
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
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-medium">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

export function Wizard({ onComplete }: WizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const formatYen = (n: number) =>
    new Intl.NumberFormat("ja-JP").format(n) + "円";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* ステップインジケーター */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
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
      </div>

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
                <p>
                  回数が多いほど精度が上がりますが計算に時間がかかります
                </p>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <h3 className="font-medium">基本情報</h3>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <span>年齢</span>
                <span className="text-foreground">
                  {form.currentAge}歳 → {form.retirementAge}歳退職 →{" "}
                  {form.endAge}歳まで
                </span>
                <span>年収</span>
                <span className="text-foreground">
                  {formatYen(form.annualSalary)}
                </span>
                <span>月間支出</span>
                <span className="text-foreground">
                  {formatYen(form.monthlyExpense)}
                </span>
              </div>

              <h3 className="font-medium mt-4">口座残高</h3>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <span>NISA</span>
                <span className="text-foreground">
                  {formatYen(form.nisaBalance)}
                </span>
                <span>特定口座</span>
                <span className="text-foreground">
                  {formatYen(form.tokuteiBalance)}（含み益率{" "}
                  {form.tokuteiGainRatio}%）
                </span>
                <span>iDeCo</span>
                <span className="text-foreground">
                  {formatYen(form.idecoBalance)}（加入{form.idecoYearsOfService}
                  年）
                </span>
              </div>

              <h3 className="font-medium mt-4">投資条件</h3>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <span>期待リターン</span>
                <span className="text-foreground">
                  {form.expectedReturn}%
                </span>
                <span>標準偏差</span>
                <span className="text-foreground">
                  {form.standardDeviation}%
                </span>
                <span>試行回数</span>
                <span className="text-foreground">
                  {form.numTrials.toLocaleString()}回
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ナビゲーション */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={prev} disabled={step === 0}>
          戻る
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>次へ</Button>
        ) : (
          <Button onClick={() => onComplete(form)}>シミュレーション開始</Button>
        )}
      </div>
    </div>
  );
}
