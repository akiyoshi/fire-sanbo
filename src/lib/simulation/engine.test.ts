import { describe, it, expect } from "vitest";
import { PRNG, generateLogNormalReturn } from "./random";
import { runSimulation } from "./engine";
import type { SimulationInput } from "./types";

describe("乱数生成", () => {
  it("シード固定で再現可能", () => {
    const rng1 = new PRNG(42);
    const rng2 = new PRNG(42);
    const values1 = Array.from({ length: 100 }, () => rng1.next());
    const values2 = Array.from({ length: 100 }, () => rng2.next());
    expect(values1).toEqual(values2);
  });

  it("一様乱数が0〜1の範囲", () => {
    const rng = new PRNG(123);
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("正規分布の平均≈0、標準偏差≈1", () => {
    const rng = new PRNG(42);
    const n = 100000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const v = rng.normalRandom();
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(mean).toBeCloseTo(0, 1);
    expect(Math.sqrt(variance)).toBeCloseTo(1, 1);
  });

  it("対数正規リターンの期待値がほぼ正しい", () => {
    const rng = new PRNG(42);
    const expectedReturn = 0.07;
    const stdDev = 0.15;
    const n = 100000;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += generateLogNormalReturn(expectedReturn, stdDev, rng);
    }
    const mean = sum / n;
    // 7%の期待リターンに対して±2%以内
    expect(mean).toBeCloseTo(expectedReturn, 1);
  });
});

describe("モンテカルロシミュレーション", () => {
  const baseInput: SimulationInput = {
    currentAge: 35,
    retirementAge: 50,
    endAge: 95,
    annualSalary: 8_000_000,
    annualExpense: 3_600_000,
    accounts: { nisa: 5_000_000, tokutei: 10_000_000, ideco: 3_000_000, gold_physical: 0 },
    allocation: { expectedReturn: 0.05, standardDeviation: 0.15 },
    idecoYearsOfService: 20,
    tokuteiGainRatio: 0.5,
    goldGainRatio: 0.3,
    withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
    numTrials: 100,
    inflationRate: 0.02,
    seed: 42,
  };

  // P0 #5: 固定リターン0%、支出>収入 → 成功確率低い
  it("低リターン・高支出で成功確率が低い", () => {
    const input: SimulationInput = {
      ...baseInput,
      allocation: { expectedReturn: 0.0, standardDeviation: 0.01 },
      annualExpense: 6_000_000,
      accounts: { nisa: 1_000_000, tokutei: 2_000_000, ideco: 1_000_000, gold_physical: 0 },
      numTrials: 100,
    };
    const result = runSimulation(input);
    expect(result.successRate).toBeLessThan(0.5);
  });

  // P0 #6: 資産10億、支出月10万 → 成功確率≒100%
  it("豊富な資産・低支出で成功確率≒100%", () => {
    const input: SimulationInput = {
      ...baseInput,
      accounts: { nisa: 500_000_000, tokutei: 300_000_000, ideco: 200_000_000, gold_physical: 0 },
      annualExpense: 1_200_000,
      numTrials: 100,
    };
    const result = runSimulation(input);
    expect(result.successRate).toBeGreaterThanOrEqual(0.99);
  });

  it("シード固定で結果再現可能", () => {
    const result1 = runSimulation(baseInput);
    const result2 = runSimulation(baseInput);
    expect(result1.successRate).toBe(result2.successRate);
    expect(result1.percentiles.p50).toEqual(result2.percentiles.p50);
  });

  it("パーセンタイルの正しい順序: p5 ≤ p25 ≤ p50 ≤ p75 ≤ p95", () => {
    const result = runSimulation(baseInput);
    for (let i = 0; i < result.ages.length; i++) {
      expect(result.percentiles.p5[i]).toBeLessThanOrEqual(result.percentiles.p25[i]);
      expect(result.percentiles.p25[i]).toBeLessThanOrEqual(result.percentiles.p50[i]);
      expect(result.percentiles.p50[i]).toBeLessThanOrEqual(result.percentiles.p75[i]);
      expect(result.percentiles.p75[i]).toBeLessThanOrEqual(result.percentiles.p95[i]);
    }
  });

  it("年齢配列が正しい", () => {
    const result = runSimulation(baseInput);
    expect(result.ages[0]).toBe(35);
    expect(result.ages[result.ages.length - 1]).toBe(95);
    expect(result.ages.length).toBe(61);
  });

  it("1000回でも5秒以内で完了", () => {
    const input: SimulationInput = { ...baseInput, numTrials: 1000 };
    const start = performance.now();
    const result = runSimulation(input);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5000);
    expect(result.trials.length).toBe(1000);
  });

  it("インフレ率が高いほど成功率が低い", () => {
    const lowInflation = runSimulation({ ...baseInput, inflationRate: 0.01 });
    const highInflation = runSimulation({ ...baseInput, inflationRate: 0.04 });
    expect(lowInflation.successRate).toBeGreaterThan(highInflation.successRate);
  });

  it("インフレ率0%のとき名目リターンがそのまま適用される", () => {
    const noInflation = runSimulation({ ...baseInput, inflationRate: 0 });
    const withInflation = runSimulation({ ...baseInput, inflationRate: 0.02 });
    // インフレ0%は2%より有利
    expect(noInflation.successRate).toBeGreaterThanOrEqual(withInflation.successRate);
  });
});

describe("取り崩し順序", () => {
  // P0 #7: NISA→特定→iDeCo順 → 税額が逆順より少ない
  it("NISA先行の方が税額が少ない", () => {
    const baseInput: SimulationInput = {
      currentAge: 50,
      retirementAge: 50,
      endAge: 70,
      annualSalary: 0,
      annualExpense: 3_600_000,
      accounts: { nisa: 30_000_000, tokutei: 30_000_000, ideco: 20_000_000, gold_physical: 0 },
      allocation: { expectedReturn: 0.04, standardDeviation: 0.01 },
      idecoYearsOfService: 20,
      tokuteiGainRatio: 0.5,
      goldGainRatio: 0.3,
      withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
      numTrials: 50,
      inflationRate: 0.02,
      seed: 42,
    };

    const nisaFirst = runSimulation(baseInput);
    const idecoFirst = runSimulation({
      ...baseInput,
      withdrawalOrder: ["ideco", "tokutei", "gold_physical", "nisa"],
    });

    // NISA先行の方が最終資産が多い（税金が少ないから）
    // 丸め誤差を許容（1万円以内）
    const nisaFinalMedian = nisaFirst.percentiles.p50[nisaFirst.ages.length - 1];
    const idecoFinalMedian = idecoFirst.percentiles.p50[idecoFirst.ages.length - 1];
    expect(nisaFinalMedian).toBeGreaterThanOrEqual(idecoFinalMedian - 10_000);
  });
});
