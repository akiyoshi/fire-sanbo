import { describe, it, expect } from "vitest";
import { optimizeWithdrawalOrder } from "./optimizer";
import type { SimulationInput } from "@/lib/simulation";

const baseInput: SimulationInput = {
  currentAge: 50,
  retirementAge: 50,
  endAge: 80,
  annualSalary: 0,
  annualExpense: 3_600_000,
  accounts: { nisa: 20_000_000, tokutei: 20_000_000, ideco: 10_000_000, gold_physical: 0 },
  allocation: { expectedReturn: 0.04, standardDeviation: 0.01 },
  idecoYearsOfService: 20,
  tokuteiGainRatio: 0.5,
  goldGainRatio: 0.3,
  withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
  numTrials: 50,
  inflationRate: 0.02,
  seed: 42,
};

describe("取り崩し順序最適化", () => {
  it("残高>0のアクティブカテゴリの全パターンが返される", () => {
    const result = optimizeWithdrawalOrder(baseInput);
    // nisa, tokutei, ideco の3カテゴリがアクティブ (gold_physical=0)
    expect(result.all).toHaveLength(6); // 3! = 6
  });

  it("4カテゴリアクティブ時は24パターンが返される", () => {
    const input = {
      ...baseInput,
      accounts: { nisa: 10_000_000, tokutei: 10_000_000, ideco: 5_000_000, gold_physical: 5_000_000 },
    };
    const result = optimizeWithdrawalOrder(input);
    expect(result.all).toHaveLength(24); // 4! = 24
  });

  it("best と worst が正しくソートされている", () => {
    const result = optimizeWithdrawalOrder(baseInput);
    expect(result.best.successRate).toBeGreaterThanOrEqual(result.worst.successRate);
  });

  it("benefitAmount が best - worst の差", () => {
    const result = optimizeWithdrawalOrder(baseInput);
    expect(result.benefitAmount).toBe(
      result.best.medianFinalAssets - result.worst.medianFinalAssets
    );
  });

  it("NISA先行がiDeCo先行より有利（非課税優先）", () => {
    const result = optimizeWithdrawalOrder(baseInput);
    const nisaFirst = result.all.find(
      (r) => r.order[0] === "nisa" && r.order[1] === "tokutei"
    )!;
    const idecoFirst = result.all.find(
      (r) => r.order[0] === "ideco" && r.order[1] === "tokutei"
    )!;
    expect(nisaFirst.medianFinalAssets).toBeGreaterThanOrEqual(
      idecoFirst.medianFinalAssets
    );
  });

  it("各パターンにラベルが付いている", () => {
    const result = optimizeWithdrawalOrder(baseInput);
    for (const r of result.all) {
      expect(r.label).toMatch(/NISA|特定|iDeCo/);
      expect(r.label).toContain("→");
    }
  });
});
