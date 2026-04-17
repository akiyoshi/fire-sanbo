import type { FormState } from "@/lib/form-state";
import { SliderInput } from "./shared";

interface AdvancedSectionProps {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  hasGold: boolean;
}

export function AdvancedSection({ form, update, hasGold }: AdvancedSectionProps) {
  return (
    <div className="space-y-4">
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
      </div>
  );
}
