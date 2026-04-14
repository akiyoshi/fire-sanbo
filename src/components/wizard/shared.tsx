import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

let _inputId = 0;
export function useInputId(prefix: string) {
  const [id] = useState(() => `${prefix}-${++_inputId}`);
  return id;
}

export function NumberInput({
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

export function SliderInput({
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

export function formatYen(n: number): string {
  return new Intl.NumberFormat("ja-JP").format(n) + "円";
}

export { formatManYen } from "@/lib/utils";
