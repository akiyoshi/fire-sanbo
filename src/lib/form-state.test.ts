import { describe, it, expect } from "vitest";
import { formToSimulationInput, DEFAULT_FORM, deriveBalancesByTaxCategory } from "./form-state";
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

  it("取り崩し順序はnisa→tokutei→gold_physical→ideco固定", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.withdrawalOrder).toEqual(["nisa", "tokutei", "gold_physical", "ideco"]);
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
  });
});
