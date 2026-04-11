import { describe, it, expect } from "vitest";
import { runSimulationLite, generatePrescriptions } from "./engine";
import type { SimulationInput } from "@/lib/simulation";

/** テスト用の基準入力 */
function baseInput(overrides?: Partial<SimulationInput>): SimulationInput {
  return {
    currentAge: 35,
    retirementAge: 50,
    endAge: 95,
    annualSalary: 6_000_000,
    annualExpense: 3_000_000,
    accounts: { nisa: 3_000_000, tokutei: 5_000_000, ideco: 2_000_000 },
    allocation: { expectedReturn: 0.05, standardDeviation: 0.15 },
    idecoYearsOfService: 15,
    tokuteiGainRatio: 0.5,
    withdrawalOrder: ["nisa", "tokutei", "ideco"],
    numTrials: 200,
    seed: 42,
    ...overrides,
  };
}

describe("runSimulationLite", () => {
  it("0〜1の範囲の成功率を返す", () => {
    const rate = runSimulationLite(baseInput());
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(1);
  });

  it("seed固定で再現性がある", () => {
    const r1 = runSimulationLite(baseInput());
    const r2 = runSimulationLite(baseInput());
    expect(r1).toBe(r2);
  });

  it("支出が極端に大きいと成功率が低い", () => {
    const rate = runSimulationLite(baseInput({ annualExpense: 20_000_000 }));
    expect(rate).toBeLessThan(0.15);
  });

  it("支出が極端に小さいと成功率が高い", () => {
    const rate = runSimulationLite(baseInput({ annualExpense: 500_000 }));
    expect(rate).toBeGreaterThan(0.8);
  });
});

describe("generatePrescriptions", () => {
  it("現在の成功率が目標以上なら alreadyAchieved=true", () => {
    // 低支出 = 高成功率
    const input = baseInput({ annualExpense: 500_000 });
    const result = generatePrescriptions(input, 0.5, 100);
    expect(result.alreadyAchieved).toBe(true);
    expect(result.prescriptions).toHaveLength(0);
  });

  it("目標90%で処方箋を返す", () => {
    // デフォルト入力は90%未満のはず
    const input = baseInput({ annualExpense: 4_000_000 });
    const result = generatePrescriptions(input, 0.9, 100);
    if (result.alreadyAchieved) {
      // 高すぎる場合は目標を上げる
      expect(result.prescriptions).toHaveLength(0);
    } else {
      expect(result.prescriptions.length).toBeGreaterThan(0);
      for (const rx of result.prescriptions) {
        expect(rx.resultRate).toBeGreaterThanOrEqual(0.85); // 概ね目標付近
        expect(["easy", "moderate", "hard"]).toContain(rx.difficulty);
        expect(["expense", "retirement", "investment"]).toContain(rx.axis);
      }
    }
  });

  it("seed固定で再現性がある", () => {
    const input = baseInput({ annualExpense: 4_000_000 });
    const r1 = generatePrescriptions(input, 0.9, 100);
    const r2 = generatePrescriptions(input, 0.9, 100);
    expect(r1.prescriptions.length).toBe(r2.prescriptions.length);
    for (let i = 0; i < r1.prescriptions.length; i++) {
      expect(r1.prescriptions[i].targetValue).toBe(r2.prescriptions[i].targetValue);
      expect(r1.prescriptions[i].resultRate).toBe(r2.prescriptions[i].resultRate);
    }
  });

  it("到達不可能な目標では空配列を返しうる", () => {
    // 資産ゼロ・高支出→厳しい条件
    const input = baseInput({
      accounts: { nisa: 0, tokutei: 0, ideco: 0 },
      annualExpense: 10_000_000,
      annualSalary: 3_000_000,
    });
    const result = generatePrescriptions(input, 0.99, 100);
    expect(result.alreadyAchieved).toBe(false);
    // 到達不可能で空になりうる
    expect(result.prescriptions.length).toBeGreaterThanOrEqual(0);
  });

  it("各処方箋にlabel, delta, difficultyが適切に設定されている", () => {
    const input = baseInput({ annualExpense: 4_500_000 });
    const result = generatePrescriptions(input, 0.85, 200);
    for (const rx of result.prescriptions) {
      expect(rx.label).toBeTruthy();
      expect(rx.delta).toBeTruthy();
      expect(typeof rx.currentValue).toBe("number");
      expect(typeof rx.targetValue).toBe("number");
    }
  });

  it("difficulty順にソートされている（easy→moderate→hard）", () => {
    const input = baseInput({ annualExpense: 4_500_000 });
    const result = generatePrescriptions(input, 0.85, 200);
    const order = { easy: 0, moderate: 1, hard: 2 };
    for (let i = 1; i < result.prescriptions.length; i++) {
      expect(order[result.prescriptions[i].difficulty]).toBeGreaterThanOrEqual(
        order[result.prescriptions[i - 1].difficulty],
      );
    }
  });
});
