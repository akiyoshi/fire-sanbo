import { describe, it, expect } from "vitest";
import { formToSimulationInput, DEFAULT_FORM } from "./form-state";
import type { FormState } from "./form-state";

describe("formToSimulationInput", () => {
  it("月額支出を年額に変換", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.annualExpense).toBe(DEFAULT_FORM.monthlyExpense * 12);
  });

  it("パーセントを小数に変換（expectedReturn, standardDeviation, tokuteiGainRatio）", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.allocation.expectedReturn).toBeCloseTo(0.05);
    expect(input.allocation.standardDeviation).toBeCloseTo(0.15);
    expect(input.tokuteiGainRatio).toBeCloseTo(0.5);
  });

  it("口座残高がそのまま渡される", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.accounts.nisa).toBe(DEFAULT_FORM.nisaBalance);
    expect(input.accounts.tokutei).toBe(DEFAULT_FORM.tokuteiBalance);
    expect(input.accounts.ideco).toBe(DEFAULT_FORM.idecoBalance);
  });

  it("取り崩し順序はnisa→tokutei→ideco固定", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.withdrawalOrder).toEqual(["nisa", "tokutei", "ideco"]);
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
        expectedReturn: NaN,
      };
      const input = formToSimulationInput(broken);
      expect(Number.isFinite(input.currentAge)).toBe(true);
      expect(Number.isFinite(input.annualSalary)).toBe(true);
      expect(Number.isFinite(input.annualExpense)).toBe(true);
      expect(Number.isFinite(input.allocation.expectedReturn)).toBe(true);
    });

    it("負の金額が0に丸められる", () => {
      const broken: FormState = {
        ...DEFAULT_FORM,
        nisaBalance: -1000000,
        tokuteiBalance: -500000,
      };
      const input = formToSimulationInput(broken);
      expect(input.accounts.nisa).toBe(0);
      expect(input.accounts.tokutei).toBe(0);
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
});
