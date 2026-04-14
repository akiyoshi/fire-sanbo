import { describe, it, expect } from "vitest";
import { SCENARIO_TEMPLATES, applyTemplate } from "@/config/scenario-templates";
import { DEFAULT_FORM, formToSimulationInput } from "@/lib/form-state";

describe("テンプレートシナリオ", () => {
  it("全テンプレートが valid FormState を生成する", () => {
    for (const t of SCENARIO_TEMPLATES) {
      const result = applyTemplate(DEFAULT_FORM, t);
      expect(result.currentAge).toBeGreaterThan(0);
      expect(result.retirementAge).toBeGreaterThan(result.currentAge);
      expect(result.endAge).toBeGreaterThan(result.retirementAge);
    }
  });

  it("applyTemplate が base の年齢・年収を維持しつつ delta を適用", () => {
    const base = { ...DEFAULT_FORM, currentAge: 40, annualSalary: 8_000_000 };
    const template = SCENARIO_TEMPLATES.find((t) => t.id === "early-retirement")!;
    const result = applyTemplate(base, template);
    expect(result.currentAge).toBe(40);
    expect(result.retirementAge).toBe(45);
    expect(result.retirementBonus?.amount).toBe(15_000_000);
  });

  it("lifeEvents がユーザー年齢に相対化される", () => {
    const base = { ...DEFAULT_FORM, currentAge: 30 };
    const template = SCENARIO_TEMPLATES.find((t) => t.id === "home-purchase")!;
    const result = applyTemplate(base, template);
    // テンプレートは35歳基準でage=40 → 30歳ユーザーなら35
    expect(result.lifeEvents![0].age).toBe(35);
  });

  it("lifeEvents が既存イベントに追記される", () => {
    const base = {
      ...DEFAULT_FORM,
      lifeEvents: [{ id: "existing", label: "既存", age: 50, amount: 1_000_000 }],
    };
    const template = SCENARIO_TEMPLATES.find((t) => t.id === "education")!;
    const result = applyTemplate(base, template);
    expect(result.lifeEvents!.length).toBe(3); // 1既存 + 2テンプレート
  });

  it("テンプレート適用後に formToSimulationInput が正常動作", () => {
    for (const t of SCENARIO_TEMPLATES) {
      const form = applyTemplate(DEFAULT_FORM, t);
      const input = formToSimulationInput(form);
      expect(input.currentAge).toBe(form.currentAge);
      expect(input.retirementAge).toBeGreaterThan(input.currentAge);
    }
  });

  it("retirementAge が currentAge 以下にならない", () => {
    const base = { ...DEFAULT_FORM, currentAge: 50 };
    const template = SCENARIO_TEMPLATES.find((t) => t.id === "early-retirement")!;
    // delta.retirementAge=45 だが currentAge=50 なので 51 にクランプ
    const result = applyTemplate(base, template);
    expect(result.retirementAge).toBeGreaterThan(result.currentAge);
  });

  it("endAge が retirementAge 以下の場合 自動調整される", () => {
    const base = { ...DEFAULT_FORM, currentAge: 50, endAge: 52 };
    const template = SCENARIO_TEMPLATES.find((t) => t.id === "early-retirement")!;
    const result = applyTemplate(base, template);
    expect(result.endAge).toBeGreaterThan(result.retirementAge);
  });

  it("pension マージが既存値を保持しつつ delta で上書き", () => {
    const base = { ...DEFAULT_FORM, pension: { kosei: 80_000, kokumin: 50_000, startAge: 65 } };
    const template = SCENARIO_TEMPLATES.find((t) => t.id === "pension-defer")!;
    const result = applyTemplate(base, template);
    // delta は startAge:70, kosei:100_000, kokumin:65_000 で全上書き
    expect(result.pension!.startAge).toBe(70);
    expect(result.pension!.kosei).toBe(100_000);
  });

  it("lifeEvents の age が endAge を超えない (上限クランプ)", () => {
    const base = { ...DEFAULT_FORM, currentAge: 80, endAge: 95 };
    const template = SCENARIO_TEMPLATES.find((t) => t.id === "education")!;
    const result = applyTemplate(base, template);
    for (const ev of result.lifeEvents!) {
      expect(ev.age).toBeLessThan(base.endAge);
      expect(ev.age).toBeGreaterThan(base.currentAge);
    }
  });

  it("lifeEvents の重複IDは上書きされる", () => {
    const base = {
      ...DEFAULT_FORM,
      lifeEvents: [{ id: "tpl-home", label: "旧住宅", age: 45, amount: 1_000_000 }],
    };
    const template = SCENARIO_TEMPLATES.find((t) => t.id === "home-purchase")!;
    const result = applyTemplate(base, template);
    const homeEvents = result.lifeEvents!.filter((e) => e.id === "tpl-home");
    expect(homeEvents).toHaveLength(1);
    expect(homeEvents[0].amount).toBe(5_000_000); // テンプレートの値で上書き
  });
});
