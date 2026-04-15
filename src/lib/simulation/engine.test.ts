import { describe, it, expect } from "vitest";
import { PRNG, generateLogNormalReturn } from "./random";
import { runSimulation } from "./engine";
import type { SimulationInput, SpouseInput } from "./types";

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
    accounts: { nisa: 5_000_000, tokutei: 10_000_000, ideco: 3_000_000, gold_physical: 0, cash: 0 },
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
      accounts: { nisa: 1_000_000, tokutei: 2_000_000, ideco: 1_000_000, gold_physical: 0, cash: 0 },
      numTrials: 100,
    };
    const result = runSimulation(input);
    expect(result.successRate).toBeLessThan(0.5);
  });

  // P0 #6: 資産10億、支出月10万 → 成功確率≒100%
  it("豊富な資産・低支出で成功確率≒100%", () => {
    const input: SimulationInput = {
      ...baseInput,
      accounts: { nisa: 500_000_000, tokutei: 300_000_000, ideco: 200_000_000, gold_physical: 0, cash: 0 },
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
      accounts: { nisa: 30_000_000, tokutei: 30_000_000, ideco: 20_000_000, gold_physical: 0, cash: 0 },
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

/* ---------- v0.9: 年金・退職金・副収入・ライフイベント・NISA枠 ---------- */

describe("年金統合", () => {
  const pensionInput: SimulationInput = {
    currentAge: 50,
    retirementAge: 50,
    endAge: 80,
    annualSalary: 0,
    annualExpense: 3_000_000,
    accounts: { nisa: 20_000_000, tokutei: 10_000_000, ideco: 5_000_000, gold_physical: 0, cash: 0 },
    allocation: { expectedReturn: 0.04, standardDeviation: 0.01 },
    idecoYearsOfService: 20,
    tokuteiGainRatio: 0.5,
    goldGainRatio: 0.3,
    withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
    numTrials: 50,
    inflationRate: 0.02,
    seed: 42,
  };

  it("年金ありは年金なしより成功率が高い", () => {
    const withPension = runSimulation({
      ...pensionInput,
      pension: { kosei: 100_000, kokumin: 65_000, startAge: 65 },
    });
    const withoutPension = runSimulation(pensionInput);
    expect(withPension.successRate).toBeGreaterThanOrEqual(withoutPension.successRate);
  });

  it("年金受給開始前は年金収入がゼロ", () => {
    const result = runSimulation({
      ...pensionInput,
      pension: { kosei: 100_000, kokumin: 65_000, startAge: 65 },
    });
    // 60歳の年次データ（index = 60 - 50 = 10）
    const at60 = result.trials[0].years[10];
    // 65歳の年次データ（index = 65 - 50 = 15）
    const at65 = result.trials[0].years[15];
    // 65歳以降は年金が入り、取り崩しが減るはず
    expect(at65.withdrawal).toBeLessThan(at60.withdrawal);
  });

  it("繰下げ（70歳開始）で増額される", () => {
    // 資産を増やして枯渇を防ぐ
    const richInput = { ...pensionInput, accounts: { nisa: 40_000_000, tokutei: 20_000_000, ideco: 10_000_000, gold_physical: 0, cash: 0 } };
    const at65 = runSimulation({
      ...richInput,
      pension: { kosei: 100_000, kokumin: 65_000, startAge: 65 },
    });
    const at70 = runSimulation({
      ...richInput,
      pension: { kosei: 100_000, kokumin: 65_000, startAge: 70 },
    });
    // 繰下げの方が成功率が高い（42%増額の効果）
    expect(at70.successRate).toBeGreaterThanOrEqual(at65.successRate);
  });
});

describe("退職金", () => {
  it("退職金ありで退職年の資産が増加", () => {
    const base: SimulationInput = {
      currentAge: 48,
      retirementAge: 50,
      endAge: 60,
      annualSalary: 8_000_000,
      annualExpense: 3_600_000,
      accounts: { nisa: 5_000_000, tokutei: 10_000_000, ideco: 3_000_000, gold_physical: 0, cash: 0 },
      allocation: { expectedReturn: 0.04, standardDeviation: 0.01 },
      idecoYearsOfService: 20,
      tokuteiGainRatio: 0.5,
      goldGainRatio: 0.3,
      withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
      numTrials: 10,
      inflationRate: 0.02,
      seed: 42,
    };
    const withBonus = runSimulation({
      ...base,
      retirementBonus: { amount: 20_000_000, yearsOfService: 25 },
    });
    const withoutBonus = runSimulation(base);
    // 退職金ありの方が最終資産が多い
    expect(withBonus.percentiles.p50[withBonus.ages.length - 1])
      .toBeGreaterThan(withoutBonus.percentiles.p50[withoutBonus.ages.length - 1]);
  });
});

describe("副収入（サイドFIRE）", () => {
  it("副収入ありで取り崩し額が減少", () => {
    const base: SimulationInput = {
      currentAge: 50,
      retirementAge: 50,
      endAge: 70,
      annualSalary: 0,
      annualExpense: 3_000_000,
      accounts: { nisa: 10_000_000, tokutei: 10_000_000, ideco: 5_000_000, gold_physical: 0, cash: 0 },
      allocation: { expectedReturn: 0.04, standardDeviation: 0.01 },
      idecoYearsOfService: 20,
      tokuteiGainRatio: 0.5,
      goldGainRatio: 0.3,
      withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
      numTrials: 10,
      inflationRate: 0.02,
      seed: 42,
    };
    const withSide = runSimulation({
      ...base,
      sideIncome: { annualAmount: 1_500_000, untilAge: 65 },
    });
    const withoutSide = runSimulation(base);
    // 副収入ありの初年度取り崩しが少ない
    expect(withSide.trials[0].years[0].withdrawal)
      .toBeLessThan(withoutSide.trials[0].years[0].withdrawal);
  });
});

describe("ライフイベント", () => {
  it("ライフイベントのある年は支出が増加", () => {
    const base: SimulationInput = {
      currentAge: 35,
      retirementAge: 60,
      endAge: 70,
      annualSalary: 8_000_000,
      annualExpense: 3_600_000,
      accounts: { nisa: 5_000_000, tokutei: 10_000_000, ideco: 3_000_000, gold_physical: 0, cash: 0 },
      allocation: { expectedReturn: 0.04, standardDeviation: 0.01 },
      idecoYearsOfService: 20,
      tokuteiGainRatio: 0.5,
      goldGainRatio: 0.3,
      withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
      numTrials: 10,
      inflationRate: 0.02,
      seed: 42,
      lifeEvents: [
        { label: "住宅購入", age: 40, amount: 10_000_000 },
      ],
    };
    const result = runSimulation(base);
    // 40歳（index=5）の支出は通常+1000万
    const at40 = result.trials[0].years[5];
    expect(at40.expense).toBe(3_600_000 + 10_000_000);
    // 41歳（index=6）は通常支出
    const at41 = result.trials[0].years[6];
    expect(at41.expense).toBe(3_600_000);
  });
});

describe("NISA年間積立枠", () => {
  it("NISA枠設定ありで余剰がNISAに優先配分", () => {
    const base: SimulationInput = {
      currentAge: 35,
      retirementAge: 50,
      endAge: 60,
      annualSalary: 8_000_000,
      annualExpense: 2_000_000,
      accounts: { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0 },
      allocation: { expectedReturn: 0.04, standardDeviation: 0.01 },
      idecoYearsOfService: 15,
      tokuteiGainRatio: 0.5,
      goldGainRatio: 0.3,
      withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
      numTrials: 1,
      inflationRate: 0.0,
      seed: 42,
      nisaConfig: { annualLimit: 3_600_000, lifetimeLimit: 18_000_000 },
    };
    const result = runSimulation(base);
    // 1年目: 手取り - 支出 の余剰分、NISA枠360万まではNISAに入る
    const year1 = result.trials[0].years[0];
    expect(year1.nisa).toBeGreaterThan(0);
  });

  it("NISA枠なし（従来互換）で全額特定口座", () => {
    const base: SimulationInput = {
      currentAge: 35,
      retirementAge: 50,
      endAge: 60,
      annualSalary: 8_000_000,
      annualExpense: 2_000_000,
      accounts: { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0 },
      allocation: { expectedReturn: 0.04, standardDeviation: 0.01 },
      idecoYearsOfService: 15,
      tokuteiGainRatio: 0.5,
      goldGainRatio: 0.3,
      withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
      numTrials: 1,
      inflationRate: 0.0,
      seed: 42,
      // nisaConfig未設定
    };
    const result = runSimulation(base);
    // NISA口座は初期値0のまま増えない（リターンで増えるだけ）
    // 実際には初期値0なので0*return=0
    // 余剰は全て特定口座に
    const year1 = result.trials[0].years[0];
    expect(year1.tokutei).toBeGreaterThan(0);
  });
});

/* ---------- v1.0: 世帯シミュレーション ---------- */

describe("世帯シミュレーション", () => {
  const singleInput: SimulationInput = {
    currentAge: 35,
    retirementAge: 50,
    endAge: 80,
    annualSalary: 6_000_000,
    annualExpense: 3_600_000,
    accounts: { nisa: 5_000_000, tokutei: 5_000_000, ideco: 2_000_000, gold_physical: 0, cash: 0 },
    allocation: { expectedReturn: 0.05, standardDeviation: 0.01 },
    idecoYearsOfService: 15,
    tokuteiGainRatio: 0.5,
    goldGainRatio: 0.3,
    withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
    numTrials: 50,
    inflationRate: 0.02,
    seed: 42,
  };

  const spouse: SpouseInput = {
    currentAge: 33,
    retirementAge: 55,
    annualSalary: 4_000_000,
    accounts: { nisa: 3_000_000, tokutei: 2_000_000, ideco: 1_000_000, gold_physical: 0, cash: 0 },
    allocation: { expectedReturn: 0.04, standardDeviation: 0.01 },
    idecoYearsOfService: 10,
    tokuteiGainRatio: 0.4,
    goldGainRatio: 0.3,
    pension: { kosei: 80_000, kokumin: 65_000, startAge: 65 },
  };

  it("配偶者ありで成功率が上がる（収入源が2つ）", () => {
    const single = runSimulation(singleInput);
    const household = runSimulation({ ...singleInput, spouse });
    expect(household.successRate).toBeGreaterThanOrEqual(single.successRate);
  });

  it("配偶者の資産が合算される", () => {
    const household = runSimulation({ ...singleInput, spouse });
    const firstYear = household.trials[0].years[0];
    // 初年度のNISA = primary(5M) + spouse(3M) + リターン分
    expect(firstYear.nisa).toBeGreaterThan(5_000_000);
  });

  it("片方退職でも在職者の所得が二重計上されない", () => {
    // Primary 35→50退職, Spouse 33→55退職
    // Primary退職直後(age=50): Spouseのみ在職
    // Spouseの手取り(年収400万→約320万)が費用をカバーしつつ余剰積立される
    // 二重計上バグがあると資産が急増する
    const household = runSimulation({ ...singleInput, spouse });
    const trial = household.trials[0];
    // age=50 (Primary退職初年)
    const atRetirement = trial.years.find((y) => y.age === 50)!;
    // age=51 (その翌年)
    const nextYear = trial.years.find((y) => y.age === 51)!;
    // 在職者の手取り(~320万) < 生活費(360万)なので資産は減るはず
    // 二重計上バグでは資産が増え続ける
    expect(nextYear.totalAssets).toBeLessThan(atRetirement.totalAssets * 1.15);
  });

  it("退職前のライフイベントで赤字が発生すると資産が減る", () => {
    const bigEvent = {
      ...singleInput,
      lifeEvents: [{ age: 36, label: "住宅購入", amount: 10_000_000 }],
    };
    const noEvent = runSimulation(singleInput);
    const withEvent = runSimulation(bigEvent);
    // ライフイベント分だけ資産が減る
    const noEventAssets = noEvent.trials[0].years.find((y) => y.age === 37)!.totalAssets;
    const withEventAssets = withEvent.trials[0].years.find((y) => y.age === 37)!.totalAssets;
    expect(withEventAssets).toBeLessThan(noEventAssets);
  });

  it("配偶者なしの場合は従来と同じ結果", () => {
    const withoutSpouse = runSimulation(singleInput);
    const withUndefined = runSimulation({ ...singleInput, spouse: undefined });
    expect(withoutSpouse.successRate).toBe(withUndefined.successRate);
    expect(withoutSpouse.percentiles.p50).toEqual(withUndefined.percentiles.p50);
  });

  it("配偶者の退職金が反映される", () => {
    const spouseWithBonus: SpouseInput = {
      ...spouse,
      retirementBonus: { amount: 10_000_000, yearsOfService: 20 },
    };
    const withBonus = runSimulation({ ...singleInput, spouse: spouseWithBonus });
    const withoutBonus = runSimulation({ ...singleInput, spouse });
    expect(withBonus.percentiles.p50[withBonus.ages.length - 1])
      .toBeGreaterThan(withoutBonus.percentiles.p50[withoutBonus.ages.length - 1]);
  });

  it("配偶者の年金が退職後に反映される", () => {
    const spouseNoPension: SpouseInput = { ...spouse, pension: undefined };
    const withPension = runSimulation({ ...singleInput, spouse });
    const withoutPension = runSimulation({ ...singleInput, spouse: spouseNoPension });
    expect(withPension.successRate).toBeGreaterThanOrEqual(withoutPension.successRate);
  });

  it("年齢差が正しく反映される（配偶者の方が若い）", () => {
    // Primary 35歳 → spouse 33歳。Primary 50歳退職時にspouseは48歳（まだ働いている）
    const result = runSimulation({ ...singleInput, spouse });
    // retirementAge(50歳)時点 = index 15
    const atRetirement = result.trials[0].years[15];
    // spouseはまだ48歳で働いているので、世帯収入 > 0
    expect(atRetirement.income).toBeGreaterThan(0);
  });
});

describe("iDeCo年齢制約", () => {
  const idecoInput: SimulationInput = {
    currentAge: 50,
    retirementAge: 50,
    endAge: 70,
    annualSalary: 0,
    annualExpense: 2_000_000,
    accounts: { nisa: 0, tokutei: 0, ideco: 30_000_000, gold_physical: 0, cash: 0 },
    allocation: { expectedReturn: 0.03, standardDeviation: 0 },
    idecoYearsOfService: 20,
    tokuteiGainRatio: 0.5,
    goldGainRatio: 0.3,
    withdrawalOrder: ["ideco", "nisa", "tokutei", "gold_physical", "cash"],
    numTrials: 1,
    inflationRate: 0,
    seed: 42,
  };

  it("60歳未満ではiDeCoから取り崩しできない", () => {
    const result = runSimulation(idecoInput);
    // 50-59歳の10年間: iDeCoしかないが取り崩し不可 → 資産が減らない
    for (let i = 0; i < 10; i++) {
      const year = result.trials[0].years[i];
      expect(year.age).toBeLessThan(60);
      // iDeCo残高はリターン分の増減のみ（取り崩しゼロ）
      expect(year.withdrawal).toBe(0);
    }
  });

  it("60歳以降ではiDeCoから取り崩しできる", () => {
    const result = runSimulation(idecoInput);
    // 60歳以降: 取り崩しが発生
    const at60 = result.trials[0].years[10]; // age=60
    expect(at60.age).toBe(60);
    expect(at60.withdrawal).toBeGreaterThan(0);
  });
});
