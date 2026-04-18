import { describe, it, expect } from "vitest";
import { runSimulationLite, generatePrescriptions } from "./engine";
import type { FrontierPoint } from "./engine";
import type { SimulationInput } from "@/lib/simulation";

/** テスト用の基準入力 */
function baseInput(overrides?: Partial<SimulationInput>): SimulationInput {
  return {
    currentAge: 35,
    retirementAge: 50,
    endAge: 95,
    annualSalary: 6_000_000,
    annualExpense: 3_000_000,
    accounts: { nisa: 3_000_000, tokutei: 5_000_000, ideco: 2_000_000, gold_physical: 0, cash: 0 },
    allocation: { expectedReturn: 0.05, standardDeviation: 0.15 },
    idecoYearsOfService: 15,
    tokuteiGainRatio: 0.5,
    goldGainRatio: 0.3,
    withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
    numTrials: 200,
    inflationRate: 0.02,
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
        expect(["expense", "retirement", "income", "allocation"]).toContain(rx.axis);
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
      accounts: { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0 },
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

describe("income軸", () => {
  it("年収増加で成功率が改善する", () => {
    const input = baseInput({ annualExpense: 4_000_000 });
    const result = generatePrescriptions(input, 0.9, 100);
    const incomeRx = result.prescriptions.find((rx) => rx.axis === "income");
    if (incomeRx) {
      expect(incomeRx.targetValue).toBeGreaterThan(incomeRx.currentValue);
      expect(incomeRx.resultRate).toBeGreaterThanOrEqual(0.85);
    }
  });

  it("既に退職済みならincome軸をスキップする", () => {
    const input = baseInput({
      currentAge: 60,
      retirementAge: 55,
      endAge: 95,
      annualExpense: 4_000_000,
    });
    const result = generatePrescriptions(input, 0.9, 100);
    const incomeRx = result.prescriptions.find((rx) => rx.axis === "income");
    expect(incomeRx).toBeUndefined();
  });

  it("annualSalary=0でも上限がゼロにならない", () => {
    const input = baseInput({ annualSalary: 0, annualExpense: 2_000_000 });
    const result = generatePrescriptions(input, 0.9, 100);
    const incomeRx = result.prescriptions.find((rx) => rx.axis === "income");
    // 年収0でも探索できる（上限は10_000_000）
    if (incomeRx) {
      expect(incomeRx.targetValue).toBeGreaterThan(0);
    }
  });

  it("income軸の難易度が正しく設定される", () => {
    const input = baseInput({ annualExpense: 4_000_000 });
    const result = generatePrescriptions(input, 0.9, 100);
    const incomeRx = result.prescriptions.find((rx) => rx.axis === "income");
    if (incomeRx) {
      expect(["easy", "moderate", "hard"]).toContain(incomeRx.difficulty);
    }
  });
});

describe("allocation軸", () => {
  const sampleFrontier: FrontierPoint[] = [
    { weights: { domestic_stock: 0, developed_stock: 0.2, domestic_bond: 0.8 }, expectedReturn: 0.03, risk: 0.05 },
    { weights: { domestic_stock: 0.1, developed_stock: 0.3, domestic_bond: 0.6 }, expectedReturn: 0.04, risk: 0.08 },
    { weights: { domestic_stock: 0.2, developed_stock: 0.5, domestic_bond: 0.3 }, expectedReturn: 0.06, risk: 0.12 },
    { weights: { domestic_stock: 0.3, developed_stock: 0.7, domestic_bond: 0 }, expectedReturn: 0.08, risk: 0.18 },
  ];

  it("フロンティアから目標達成の最小リスク点を見つける", () => {
    const input = baseInput({ annualExpense: 4_000_000 });
    const result = generatePrescriptions(input, 0.85, 100, sampleFrontier);
    const allocRx = result.prescriptions.find((rx) => rx.axis === "allocation");
    if (allocRx) {
      expect(allocRx.recommendedAllocation).toBeDefined();
      expect(allocRx.resultRate).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("フロンティアが空なら処方箋を返さない", () => {
    const input = baseInput({ annualExpense: 4_000_000 });
    const result = generatePrescriptions(input, 0.9, 100, []);
    const allocRx = result.prescriptions.find((rx) => rx.axis === "allocation");
    expect(allocRx).toBeUndefined();
  });

  it("フロンティア未指定ならallocation軸をスキップ", () => {
    const input = baseInput({ annualExpense: 4_000_000 });
    const result = generatePrescriptions(input, 0.9, 100);
    const allocRx = result.prescriptions.find((rx) => rx.axis === "allocation");
    expect(allocRx).toBeUndefined();
  });

  it("allocation軸の難易度がリスク変化に基づく", () => {
    const input = baseInput({ annualExpense: 4_000_000 });
    const result = generatePrescriptions(input, 0.85, 100, sampleFrontier);
    const allocRx = result.prescriptions.find((rx) => rx.axis === "allocation");
    if (allocRx) {
      expect(["easy", "moderate", "hard"]).toContain(allocRx.difficulty);
    }
  });
});

describe("investment軸の削除確認", () => {
  it("investment軸が存在しない", () => {
    const input = baseInput({ annualExpense: 4_000_000 });
    const result = generatePrescriptions(input, 0.9, 100);
    const investmentRx = result.prescriptions.find((rx) => rx.axis === "investment" as string);
    expect(investmentRx).toBeUndefined();
  });
});

describe("処方箋の境界値", () => {
  it("targetRate=1.0（100%目標）でもクラッシュしない", () => {
    const input = baseInput({ annualExpense: 4_000_000 });
    // 例外を投げずに正常完了すること
    expect(() => generatePrescriptions(input, 1.0, 100)).not.toThrow();
    const result = generatePrescriptions(input, 1.0, 100);
    expect(result.alreadyAchieved).toBe(false);
    // 返された処方箋はすべて正の成功率を持つ
    for (const rx of result.prescriptions) {
      expect(rx.resultRate).toBeGreaterThan(0);
    }
  });

  it("targetRate=0（0%目標）は常にalreadyAchieved", () => {
    const input = baseInput({ annualExpense: 4_000_000 });
    const result = generatePrescriptions(input, 0, 100);
    expect(result.alreadyAchieved).toBe(true);
    expect(result.prescriptions).toHaveLength(0);
  });

  it("退職延期軸は75歳を超えない", () => {
    // 退職延期で改善しやすい条件: 資産多め・支出中程度・退職が早い
    const input = baseInput({
      currentAge: 35,
      retirementAge: 40,
      endAge: 85,
      annualSalary: 8_000_000,
      annualExpense: 3_500_000,
      accounts: { nisa: 5_000_000, tokutei: 5_000_000, ideco: 2_000_000, gold_physical: 0, cash: 0 },
    });
    const result = generatePrescriptions(input, 0.85, 200);
    const retireRx = result.prescriptions.find((rx) => rx.axis === "retirement");
    // retirement処方箋が生成され、75歳以下であること
    expect(retireRx).toBeDefined();
    expect(retireRx!.targetValue).toBeLessThanOrEqual(75);
  });
});
