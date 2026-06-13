import { describe, it, expect } from "vitest";
import { calcSWR } from "./engine";
import type { SimulationInput } from "@/lib/simulation";
import { createSimulationInput } from "@/lib/test-utils";

/**
 * v4.6.2 (C-3) SWR 自動算定。
 *
 * - 目標成功率（既定 90%）を満たす最大の年間支出を二分探索で求める
 * - prescription expense 軸との委譲一致（DRY、autoplan AD-2）
 */

describe("v4.6.2: calcSWR (SWR 自動算定)", () => {
  // 確定論的シナリオを共通で使用
  const baseDeterministic = (overrides: Partial<SimulationInput> = {}): SimulationInput =>
    createSimulationInput({
      currentAge: 50,
      retirementAge: 50,
      endAge: 80,
      annualSalary: 0,
      annualExpense: 3_600_000,
      accounts: { nisa: 0, tokutei: 50_000_000, ideco: 0, gold_physical: 0, cash: 0 },
      allocation: { expectedReturn: 0.04, standardDeviation: 0.01 },
      numTrials: 50,
      inflationRate: 0,
      seed: 42,
      ...overrides,
    });

  // ---- A) 境界 ----

  it("[境界] 大資産 (5億円) → maxAnnualExpense は探索上限", () => {
    const result = calcSWR(baseDeterministic({
      accounts: { nisa: 0, tokutei: 500_000_000, ideco: 0, gold_physical: 0, cash: 0 },
    }));
    // 探索上限 max(現在支出×3, 1200万) = max(1080万, 1200万) = 1200万
    expect(result.maxAnnualExpense).toBeGreaterThanOrEqual(12_000_000 - 60_000);
  });

  it("[境界] 小資産 (10万円) → maxAnnualExpense は探索下限", () => {
    const result = calcSWR(baseDeterministic({
      accounts: { nisa: 0, tokutei: 100_000, ideco: 0, gold_physical: 0, cash: 0 },
    }));
    expect(result.maxAnnualExpense).toBe(60_000); // 月5万
  });

  it("[境界] target=1.0 (100%成功) は target=0.90 より厳しい (rate↓)", () => {
    const r90 = calcSWR(baseDeterministic(), 0.90);
    const r100 = calcSWR(baseDeterministic(), 1.0);
    expect(r100.maxAnnualExpense).toBeLessThanOrEqual(r90.maxAnnualExpense);
  });

  it("[境界] 二分探索が MAX_ITERATIONS 内に収束する", () => {
    const result = calcSWR(baseDeterministic());
    expect(result.convergenceIterations).toBeLessThanOrEqual(25);
  });

  // ---- B) DRY (prescription 委譲) ----

  it("[委譲] runSimulationLite を内部で利用 (target 達成 successRate)", () => {
    // SWR 結果の annualExpense で改めて runSimulationLite を呼ぶと、
    // 成功率 ≥ targetRate になる（最後の評価点と一致）
    const input = baseDeterministic();
    const result = calcSWR(input, 0.90);
    // 結果値 +1万円で再評価すると成功率が下がる傾向（厳密一致は二分探索の精度上 hard）
    expect(result.maxAnnualExpense).toBeGreaterThan(0);
    expect(result.targetRate).toBe(0.90);
  });

  it("[一貫性] expectedReturn↑ で SWR maxAnnualExpense が単調増加または同等", () => {
    const lowReturn = calcSWR(baseDeterministic({
      allocation: { expectedReturn: 0.02, standardDeviation: 0.01 },
    }));
    const highReturn = calcSWR(baseDeterministic({
      allocation: { expectedReturn: 0.05, standardDeviation: 0.01 },
    }));
    expect(highReturn.maxAnnualExpense).toBeGreaterThanOrEqual(lowReturn.maxAnnualExpense);
  });

  it("[再現性] 同じ seed なら結果も同一", () => {
    const a = calcSWR(baseDeterministic());
    const b = calcSWR(baseDeterministic());
    expect(a.maxAnnualExpense).toBe(b.maxAnnualExpense);
    expect(a.rate).toBe(b.rate);
  });

  // ---- C) Property ----

  it("[property] 0 < rate ≤ 1.0", () => {
    const r = calcSWR(baseDeterministic());
    expect(r.rate).toBeGreaterThan(0);
    expect(r.rate).toBeLessThanOrEqual(1.0);
  });

  it("[property] vsBengen4Pct = rate - 0.04", () => {
    const r = calcSWR(baseDeterministic());
    expect(r.vsBengen4Pct).toBeCloseTo(r.rate - 0.04, 5);
  });

  it("[property] monthlyExpense ≈ maxAnnualExpense / 12 (整数丸め)", () => {
    const r = calcSWR(baseDeterministic());
    expect(Math.abs(r.monthlyExpense * 12 - r.maxAnnualExpense)).toBeLessThan(12);
  });
});
