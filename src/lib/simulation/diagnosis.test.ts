import { describe, it, expect } from "vitest";
import { diagnoseFailure, findP5Trial } from "./diagnosis";
import type { TrialResult, SimulationResult, YearResult } from "./types";

function makeYear(overrides: Partial<YearResult> & { age: number }): YearResult {
  return {
    totalAssets: 10_000_000,
    nisa: 0,
    tokutei: 0,
    ideco: 0,
    gold_physical: 0,
    cash: 0,
    income: 0,
    expense: 3_000_000,
    taxBreakdown: { incomeTax: 0, residentTax: 0, socialInsurance: 0, withdrawalTax: 0, total: 0 },
    withdrawal: 3_000_000,
    portfolioReturn: 0.05,
    ...overrides,
  };
}

function makeTrial(years: YearResult[], success: boolean, depletionAge: number | null = null): TrialResult {
  return {
    years,
    success,
    depletionAge,
    finalAssets: years[years.length - 1]?.totalAssets ?? 0,
  };
}

describe("diagnoseFailure", () => {
  const medianAssets = Array(20).fill(20_000_000);
  const retirementAge = 55;

  it("成功試行を正しく判定する", () => {
    const years = [makeYear({ age: 55 }), makeYear({ age: 56 }), makeYear({ age: 57 })];
    const trial = makeTrial(years, true);
    const result = diagnoseFailure(trial, retirementAge, medianAssets);
    expect(result.cause).toBe("none");
    expect(result.causeLabel).toBe("成功");
  });

  it("暴落型を検出する: 退職後5年以内に−20%超", () => {
    const years = [
      makeYear({ age: 55, portfolioReturn: 0.05, totalAssets: 30_000_000 }),
      makeYear({ age: 56, portfolioReturn: -0.30, totalAssets: 18_000_000 }),
      makeYear({ age: 57, portfolioReturn: -0.05, totalAssets: 14_000_000 }),
      makeYear({ age: 58, totalAssets: 10_000_000 }),
      makeYear({ age: 59, totalAssets: 5_000_000 }),
      makeYear({ age: 60, totalAssets: 0 }),
    ];
    const trial = makeTrial(years, false, 60);
    const result = diagnoseFailure(trial, retirementAge, medianAssets);
    expect(result.cause).toBe("crash");
    expect(result.causeLabel).toBe("暴落型");
    expect(result.turningPoint?.age).toBe(56);
    expect(result.summary).toContain("-30%");
    expect(result.summary).toContain("60歳で資産枯渇");
  });

  it("暴落がウィンドウ外(6年目以降)の場合は暴落型にならない", () => {
    const years = [
      makeYear({ age: 55, portfolioReturn: 0.03 }),
      makeYear({ age: 56, portfolioReturn: 0.02 }),
      makeYear({ age: 57, portfolioReturn: 0.01 }),
      makeYear({ age: 58, portfolioReturn: 0.00 }),
      makeYear({ age: 59, portfolioReturn: -0.01 }),
      makeYear({ age: 60, portfolioReturn: -0.02 }),
      makeYear({ age: 61, portfolioReturn: -0.35, totalAssets: 5_000_000 }),
      makeYear({ age: 65, totalAssets: 0 }),
    ];
    const trial = makeTrial(years, false, 65);
    const result = diagnoseFailure(trial, retirementAge, medianAssets);
    expect(result.cause).not.toBe("crash");
  });

  it("資金不足型を検出する: 暴落なしでも枯渇", () => {
    const years = Array.from({ length: 10 }, (_, i) => 
      makeYear({
        age: 55 + i,
        portfolioReturn: 0.03,
        totalAssets: Math.max(0, 10_000_000 - i * 2_000_000),
      }),
    );
    const trial = makeTrial(years, false, 60);
    const result = diagnoseFailure(trial, retirementAge, medianAssets);
    expect(result.cause).toBe("underfunded");
    expect(result.causeLabel).toBe("資金不足型");
  });

  it("ライフイベント集中型を検出する: 支出が通常の2倍以上", () => {
    const years = [
      makeYear({ age: 55, expense: 3_000_000 }),
      makeYear({ age: 56, expense: 3_000_000 }),
      makeYear({ age: 57, expense: 8_000_000, totalAssets: 5_000_000 }), // 大きなイベント
      makeYear({ age: 58, expense: 3_000_000, totalAssets: 2_000_000 }),
      makeYear({ age: 59, expense: 3_000_000, totalAssets: 0 }),
    ];
    const trial = makeTrial(years, false, 59);
    const result = diagnoseFailure(trial, retirementAge, medianAssets);
    expect(result.cause).toBe("life_event");
    expect(result.causeLabel).toBe("ライフイベント集中型");
    expect(result.turningPoint?.age).toBe(57);
  });

  it("長寿リスク型を検出する: 80歳以降に枯渇", () => {
    const years = Array.from({ length: 30 }, (_, i) =>
      makeYear({
        age: 55 + i,
        portfolioReturn: 0.02,
        totalAssets: Math.max(0, 30_000_000 - i * 1_200_000),
      }),
    );
    const trial = makeTrial(years, false, 82);
    const result = diagnoseFailure(trial, retirementAge, medianAssets);
    expect(result.cause).toBe("longevity");
    expect(result.causeLabel).toBe("長寿リスク型");
  });
});

describe("findP5Trial", () => {
  it("全試行の下位5%に近い試行を返す", () => {
    const trials: TrialResult[] = Array.from({ length: 100 }, (_, i) =>
      makeTrial(
        [makeYear({ age: 55, totalAssets: i * 1_000_000 })],
        i > 10,
        i <= 10 ? 60 : null,
      ),
    );
    // finalAssetsでソートして下位5%付近
    trials.forEach((t, i) => { t.finalAssets = i * 1_000_000; });

    const result: SimulationResult = {
      successRate: 0.9,
      trials,
      percentiles: { p5: [], p25: [], p50: [], p75: [], p95: [] },
      ages: [55],
    };

    const p5 = findP5Trial(result);
    // 100試行のp5 = index 4 (0-based), finalAssets = 4_000_000
    expect(p5.finalAssets).toBe(4_000_000);
  });
});
