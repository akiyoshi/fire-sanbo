import type { FormState } from "@/lib/form-state";

export interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** FormState の差分。applyTemplate で base にマージ */
  delta: Partial<FormState>;
  /** 自動 open にするセクション */
  openSections: string[];
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: "career-change",
    name: "転職",
    description: "年収が変わる場合のシミュレーション",
    icon: "Briefcase",
    delta: {
      annualSalary: 5_000_000,
      retirementAge: 55,
      retirementBonus: { amount: 5_000_000, yearsOfService: 10 },
    },
    openSections: ["income"],
  },
  {
    id: "home-purchase",
    name: "住宅購入",
    description: "住宅ローン返済を一時支出に反映",
    icon: "Home",
    delta: {
      lifeEvents: [
        { id: "tpl-home", label: "住宅購入 頭金", age: 40, amount: 5_000_000 },
      ],
    },
    openSections: ["events"],
  },
  {
    id: "education",
    name: "教育費",
    description: "子供の教育費をライフイベントに追加",
    icon: "GraduationCap",
    delta: {
      lifeEvents: [
        { id: "tpl-edu1", label: "大学入学 (第1子)", age: 48, amount: 5_000_000 },
        { id: "tpl-edu2", label: "大学入学 (第2子)", age: 51, amount: 5_000_000 },
      ],
    },
    openSections: ["events"],
  },
  {
    id: "early-retirement",
    name: "早期退職",
    description: "45歳でリタイア、退職金・年金を反映",
    icon: "Palmtree",
    delta: {
      retirementAge: 45,
      retirementBonus: { amount: 15_000_000, yearsOfService: 20 },
      pension: { kosei: 120_000, kokumin: 65_000, startAge: 65 },
    },
    openSections: ["income"],
  },
  {
    id: "pension-defer",
    name: "年金繰下げ",
    description: "年金開始を70歳に繰り下げて増額",
    icon: "Clock",
    delta: {
      pension: { kosei: 100_000, kokumin: 65_000, startAge: 70 },
    },
    openSections: ["income"],
  },
];

/**
 * base FormState にテンプレートの delta をマージ。
 * lifeEvents は既存に追加（重複IDは上書き）。
 */
export function applyTemplate(base: FormState, template: ScenarioTemplate): FormState {
  const { delta } = template;
  const next = { ...base };

  // lifeEvents は追記マージ
  if (delta.lifeEvents) {
    const existing = [...(base.lifeEvents ?? [])];
    for (const ev of delta.lifeEvents) {
      // 年齢をユーザーの現在年齢に相対化 (テンプレートは35歳基準)
      const relativeAge = ev.age - 35 + base.currentAge;
      const adjusted = { ...ev, age: Math.max(relativeAge, base.currentAge + 1) };
      const idx = existing.findIndex((e) => e.id === adjusted.id);
      if (idx >= 0) existing[idx] = adjusted;
      else existing.push(adjusted);
    }
    next.lifeEvents = existing;
  }

  // pension, retirementBonus はオブジェクトマージ
  if (delta.pension) {
    next.pension = { ...(base.pension ?? { kosei: 0, kokumin: 0, startAge: 65 }), ...delta.pension };
  }
  if (delta.retirementBonus) {
    next.retirementBonus = { ...(base.retirementBonus ?? { amount: 0, yearsOfService: 0 }), ...delta.retirementBonus };
  }

  // スカラー値は直接上書き
  if (delta.annualSalary !== undefined) next.annualSalary = delta.annualSalary;
  if (delta.retirementAge !== undefined) {
    next.retirementAge = Math.max(delta.retirementAge, base.currentAge + 1);
    if (next.endAge <= next.retirementAge) next.endAge = next.retirementAge + 1;
  }

  return next;
}
