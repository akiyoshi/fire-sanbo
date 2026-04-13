import { describe, it, expect, beforeEach } from "vitest";
import {
  formToSimulationInput,
  DEFAULT_FORM,
  deriveBalancesByTaxCategory,
  saveForm,
  loadForm,
  clearForm,
  loadScenarios,
  saveScenario,
  updateScenario,
  deleteScenario,
  exportFormToJSON,
  importFormFromJSON,
} from "./form-state";
import type { FormState } from "./form-state";

describe("formToSimulationInput", () => {
  it("月額支出を年額に変換", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.annualExpense).toBe(DEFAULT_FORM.monthlyExpense * 12);
  });

  it("ポートフォリオからリターン・リスクが自動計算される", () => {
    const form: FormState = {
      ...DEFAULT_FORM,
      portfolio: [
        { assetClass: "developed_stock", taxCategory: "nisa", amount: 10_000_000 },
      ],
    };
    const input = formToSimulationInput(form);
    // 先進国株式: 9% return, 19.5% risk
    expect(input.allocation.expectedReturn).toBeCloseTo(0.09, 2);
    expect(input.allocation.standardDeviation).toBeCloseTo(0.195, 2);
  });

  it("tokuteiGainRatio がパーセントから小数に変換される", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.tokuteiGainRatio).toBeCloseTo(DEFAULT_FORM.tokuteiGainRatio / 100);
  });

  it("goldGainRatio がパーセントから小数に変換される", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.goldGainRatio).toBeCloseTo(DEFAULT_FORM.goldGainRatio / 100);
  });

  it("ポートフォリオから課税種別ごとの残高が自動集計される", () => {
    const form: FormState = {
      ...DEFAULT_FORM,
      portfolio: [
        { assetClass: "developed_stock", taxCategory: "nisa", amount: 5_000_000 },
        { assetClass: "domestic_stock", taxCategory: "tokutei", amount: 3_000_000 },
        { assetClass: "developed_bond", taxCategory: "ideco", amount: 2_000_000 },
        { assetClass: "gold", taxCategory: "gold_physical", amount: 1_000_000 },
      ],
    };
    const input = formToSimulationInput(form);
    expect(input.accounts.nisa).toBe(5_000_000);
    expect(input.accounts.tokutei).toBe(3_000_000);
    expect(input.accounts.ideco).toBe(2_000_000);
    expect(input.accounts.gold_physical).toBe(1_000_000);
  });

  it("取り崩し順序はcash→nisa→tokutei→gold_physical→ideco固定", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.withdrawalOrder).toEqual(["cash", "nisa", "tokutei", "gold_physical", "ideco"]);
  });

  it("seed が数値", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(typeof input.seed).toBe("number");
    expect(Number.isFinite(input.seed)).toBe(true);
  });

  describe("NaN防御", () => {
    it("NaN入力がフォールバック値に変換される", () => {
      const broken: FormState = {
        ...DEFAULT_FORM,
        currentAge: NaN,
        annualSalary: NaN,
        monthlyExpense: NaN,
      };
      const input = formToSimulationInput(broken);
      expect(Number.isFinite(input.currentAge)).toBe(true);
      expect(Number.isFinite(input.annualSalary)).toBe(true);
      expect(Number.isFinite(input.annualExpense)).toBe(true);
    });

    it("numTrialsの最小値は10", () => {
      const broken: FormState = {
        ...DEFAULT_FORM,
        numTrials: 0,
      };
      const input = formToSimulationInput(broken);
      expect(input.numTrials).toBeGreaterThanOrEqual(10);
    });

    it("numTrialsの上限は10,000", () => {
      const form: FormState = { ...DEFAULT_FORM, numTrials: 100_000 };
      const input = formToSimulationInput(form);
      expect(input.numTrials).toBe(10_000);
    });
  });

  describe("年齢整合性ガード", () => {
    it("retirementAge < currentAge の場合 currentAge+1 に補正される", () => {
      const form: FormState = { ...DEFAULT_FORM, currentAge: 50, retirementAge: 40 };
      const input = formToSimulationInput(form);
      expect(input.retirementAge).toBeGreaterThan(input.currentAge);
    });

    it("endAge < retirementAge の場合 retirementAge+1 に補正される", () => {
      const form: FormState = { ...DEFAULT_FORM, retirementAge: 60, endAge: 55 };
      const input = formToSimulationInput(form);
      expect(input.endAge).toBeGreaterThan(input.retirementAge);
    });

    it("全年齢が同値の場合でも currentAge < retirementAge < endAge が保証される", () => {
      const form: FormState = { ...DEFAULT_FORM, currentAge: 50, retirementAge: 50, endAge: 50 };
      const input = formToSimulationInput(form);
      expect(input.currentAge).toBe(50);
      expect(input.retirementAge).toBe(51);
      // endAge は safeNum の min=60 が適用された上で retirementAge+1 との max
      expect(input.endAge).toBe(60);
    });

    it("endAge が120歳を超えない（DoS防止）", () => {
      const form: FormState = { ...DEFAULT_FORM, endAge: 999999 };
      const input = formToSimulationInput(form);
      expect(input.endAge).toBeLessThanOrEqual(120);
    });

    it("retirementAge が120歳を超えない", () => {
      const form: FormState = { ...DEFAULT_FORM, currentAge: 118, retirementAge: 200 };
      const input = formToSimulationInput(form);
      expect(input.retirementAge).toBeLessThanOrEqual(120);
    });
  });

  describe("ポートフォリオ合成", () => {
    it("有効なポートフォリオで合成リターン・リスクがSimulationInputに反映される", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        portfolio: [
          { assetClass: "developed_stock", taxCategory: "nisa", amount: 10_000_000 },
        ],
      };
      const input = formToSimulationInput(form);
      expect(input.allocation.expectedReturn).toBeCloseTo(0.09, 2);
      expect(input.allocation.standardDeviation).toBeCloseTo(0.195, 2);
    });

    it("現金100%ポートフォリオでリスクフロア0.001が適用される", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        portfolio: [
          { assetClass: "cash", taxCategory: "tokutei", amount: 5_000_000 },
        ],
      };
      const input = formToSimulationInput(form);
      expect(input.allocation.expectedReturn).toBe(0);
      expect(input.allocation.standardDeviation).toBe(0.001);
    });

    it("ポートフォリオ金額0のときはフォールバック値(5%/15%)が使用される", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        portfolio: [
          { assetClass: "developed_stock", taxCategory: "nisa", amount: 0 },
        ],
      };
      const input = formToSimulationInput(form);
      expect(input.allocation.expectedReturn).toBeCloseTo(0.05);
      expect(input.allocation.standardDeviation).toBeCloseTo(0.15);
    });
  });

  it("inflationRate がパーセントから小数に変換される", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.inflationRate).toBeCloseTo(DEFAULT_FORM.inflationRate / 100);
  });

  describe("localStorage 永続化", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("saveForm → loadForm でラウンドトリップできる", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        currentAge: 40,
        portfolio: [
          { assetClass: "developed_stock", taxCategory: "nisa", amount: 5_000_000 },
          { assetClass: "gold", taxCategory: "gold_physical", amount: 1_000_000 },
        ],
      };
      saveForm(form);
      const loaded = loadForm();
      expect(loaded).toEqual(form);
    });

    it("loadForm はデータなしで null を返す", () => {
      expect(loadForm()).toBeNull();
    });

    it("clearForm でデータが削除される", () => {
      saveForm(DEFAULT_FORM);
      expect(loadForm()).not.toBeNull();
      clearForm();
      expect(loadForm()).toBeNull();
    });

    it("スキーマバージョン不一致で null を返す", () => {
      localStorage.setItem("fire-sanbo-form", JSON.stringify({
        version: 999,
        form: DEFAULT_FORM,
      }));
      expect(loadForm()).toBeNull();
    });

    it("不正なJSONで null を返す", () => {
      localStorage.setItem("fire-sanbo-form", "not json");
      expect(loadForm()).toBeNull();
    });
  });
});

describe("deriveBalancesByTaxCategory", () => {
  it("同一課税種別の複数銘柄を合算する", () => {
    const balances = deriveBalancesByTaxCategory([
      { assetClass: "developed_stock", taxCategory: "nisa", amount: 3_000_000 },
      { assetClass: "domestic_stock", taxCategory: "nisa", amount: 2_000_000 },
    ]);
    expect(balances.nisa).toBe(5_000_000);
    expect(balances.tokutei).toBe(0);
    expect(balances.ideco).toBe(0);
    expect(balances.gold_physical).toBe(0);
    expect(balances.cash).toBe(0);
  });
});

describe("シナリオ管理", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saveScenario → loadScenarios でラウンドトリップ", () => {
    const s1 = saveScenario("現状維持", DEFAULT_FORM);
    const s2 = saveScenario("転職ケース", { ...DEFAULT_FORM, annualSalary: 8_000_000 });
    const scenarios = loadScenarios();
    expect(scenarios).toHaveLength(2);
    expect(scenarios[0].name).toBe("現状維持");
    expect(scenarios[1].name).toBe("転職ケース");
    expect(scenarios[1].form.annualSalary).toBe(8_000_000);
  });

  it("updateScenario でフォームを更新", () => {
    const s = saveScenario("テスト", DEFAULT_FORM);
    updateScenario(s.id, { ...DEFAULT_FORM, currentAge: 42 });
    const scenarios = loadScenarios();
    expect(scenarios[0].form.currentAge).toBe(42);
  });

  it("deleteScenario でシナリオを削除", () => {
    const s1 = saveScenario("A", DEFAULT_FORM);
    const s2 = saveScenario("B", DEFAULT_FORM);
    deleteScenario(s1.id);
    const scenarios = loadScenarios();
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].name).toBe("B");
  });

  it("シナリオなしで空配列を返す", () => {
    expect(loadScenarios()).toEqual([]);
  });
});

describe("JSON エクスポート/インポート", () => {
  it("exportFormToJSON → importFormFromJSON でラウンドトリップ", () => {
    const form: FormState = {
      ...DEFAULT_FORM,
      currentAge: 40,
      annualSalary: 7_000_000,
    };
    const json = exportFormToJSON(form);
    const imported = importFormFromJSON(json);
    expect(imported).toEqual(form);
  });

  it("不正なJSON文字列で null を返す", () => {
    expect(importFormFromJSON("not valid json")).toBeNull();
  });

  it("バージョン不一致で null を返す", () => {
    const json = JSON.stringify({ version: 999, form: DEFAULT_FORM });
    expect(importFormFromJSON(json)).toBeNull();
  });

  it("formフィールドが不正で null を返す", () => {
    const json = JSON.stringify({ version: 2, form: { foo: "bar" } });
    expect(importFormFromJSON(json)).toBeNull();
  });
});
