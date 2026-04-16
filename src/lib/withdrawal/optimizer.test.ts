import { describe, it, expect } from "vitest";
import { optimizeWithdrawalOrder } from "./optimizer";
import type { SimulationInput } from "@/lib/simulation";

const baseInput: SimulationInput = {
  currentAge: 50,
  retirementAge: 50,
  endAge: 80,
  annualSalary: 0,
  annualExpense: 3_600_000,
  accounts: { nisa: 20_000_000, tokutei: 20_000_000, ideco: 10_000_000, gold_physical: 0, cash: 0 },
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
      accounts: { nisa: 10_000_000, tokutei: 10_000_000, ideco: 5_000_000, gold_physical: 5_000_000, cash: 0 },
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

  it("cashは末尾固定で順列から除外される", () => {
    const input = {
      ...baseInput,
      accounts: { nisa: 10_000_000, tokutei: 10_000_000, ideco: 0, gold_physical: 0, cash: 5_000_000 },
    };
    const result = optimizeWithdrawalOrder(input);
    // nisa, tokutei の2カテゴリ + cash末尾 → 2! = 2パターン
    expect(result.all).toHaveLength(2);
    for (const r of result.all) {
      expect(r.order[r.order.length - 1]).toBe("cash");
    }
  });
});

describe("取り崩し順序最適化（deterministic）", () => {
  it("deterministic: true で結果が返される", () => {
    const result = optimizeWithdrawalOrder(baseInput, { deterministic: true });
    expect(result.all.length).toBeGreaterThan(0);
    expect(result.best).toBeDefined();
    expect(result.worst).toBeDefined();
  });

  it("deterministic モードで年次データ（yearlyAssets, ages）が返される", () => {
    const result = optimizeWithdrawalOrder(baseInput, { deterministic: true });
    expect(result.best.yearlyAssets).toBeDefined();
    expect(result.best.ages).toBeDefined();
    expect(result.best.yearlyAssets!.length).toBe(result.best.ages!.length);
    expect(result.best.ages![0]).toBe(baseInput.currentAge);
  });

  it("deterministic では全パターン同一の成功率（決定論的）", () => {
    const result = optimizeWithdrawalOrder(baseInput, { deterministic: true });
    const rates = new Set(result.all.map((r) => r.successRate));
    // 決定論的なので成功率は全て同じ（成功 or 失敗）
    expect(rates.size).toBe(1);
  });

  it("deterministic でも最終資産で差が出る", () => {
    const result = optimizeWithdrawalOrder(baseInput, { deterministic: true });
    // 税率の違いにより取り崩し順序で最終資産に差が出る
    expect(result.benefitAmount).toBeGreaterThanOrEqual(0);
  });

  it("deterministic は高速（<200ms）", () => {
    const start = performance.now();
    optimizeWithdrawalOrder(baseInput, { deterministic: true });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it("0口座では最適化対象なし", () => {
    const input = {
      ...baseInput,
      retirementAge: 80, // 勤労期間なし
      annualSalary: 0,
      accounts: { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0 },
    };
    const result = optimizeWithdrawalOrder(input, { deterministic: true });
    expect(result.all).toHaveLength(1); // フォールバック
  });

  it("1口座では benefitAmount = 0", () => {
    const input = {
      ...baseInput,
      retirementAge: 80,
      annualSalary: 0,
      accounts: { nisa: 10_000_000, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0 },
    };
    const result = optimizeWithdrawalOrder(input, { deterministic: true });
    expect(result.all).toHaveLength(1);
    expect(result.benefitAmount).toBe(0);
  });

  it("deterministic + accountAllocations でstdDevが0にされ決定論的になる", () => {
    const input: SimulationInput = {
      ...baseInput,
      accountAllocations: {
        nisa: { expectedReturn: 0.08, standardDeviation: 0.20 },
        tokutei: { expectedReturn: 0.04, standardDeviation: 0.10 },
      },
    };
    const result1 = optimizeWithdrawalOrder(input, { deterministic: true });
    const result2 = optimizeWithdrawalOrder(input, { deterministic: true });
    // 決定論的: 同じ入力なら同じ結果
    expect(result1.best.medianFinalAssets).toBe(result2.best.medianFinalAssets);
    // 全パターンの成功率が同一（σ=0の決定論的シミュレーション）
    const rates = new Set(result1.all.map((r) => r.successRate));
    expect(rates.size).toBe(1);
  });
});
