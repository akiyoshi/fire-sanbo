import { describe, it, expect } from "vitest";
import {
  calcEffectiveYearsForLumpSum,
  calcCombinedLumpSumNet,
  findOptimalIdecoLumpSumAge,
  calcRetirementBonusNet,
} from "./engine";

/**
 * v4.6.3 (T-2): iDeCo × 退職金 5/19 年ルール（重複勤務期間）テスト。
 *
 * 完全実装: 所得税法施行令70条 + 基本通達30-12 に基づく。
 *
 * - **5年ルール**: iDeCo一時金（先）→ 退職金（後）。受給年差 ≥ 5 でフル控除
 * - **19年ルール**: 退職金（先）→ iDeCo一時金（後）。受給年差 ≥ 19 でフル控除
 * - 重複期間 = `min(両者の年数) - gap`
 * - 後発側の控除年数 = `max(0, secondYears - overlap)`
 */

describe("v4.6.3: calcEffectiveYearsForLumpSum (5/19年ルール)", () => {
  // ---- A) 境界 (13件) ----

  it("[境界1] gap=0 (同年受給) → overlap=min(years), secondary実効=0 (80万下限保証は別関数)", () => {
    const eff = calcEffectiveYearsForLumpSum(60, 30, 60, 20, 5);
    // overlap = min(30,20)-0 = 20, secondary effective = 20 - 20 = 0
    expect(eff).toBe(0);
  });

  it("[境界2] gap=4 (5年未満) → overlap=min(30,20)-4=16, secondary effective=4", () => {
    const eff = calcEffectiveYearsForLumpSum(60, 30, 64, 20, 5);
    expect(eff).toBe(4);
  });

  it("[境界3] gap=5 (ちょうどルール年数) → フル控除", () => {
    const eff = calcEffectiveYearsForLumpSum(60, 30, 65, 20, 5);
    expect(eff).toBe(20);
  });

  it("[境界4] gap=6 (5年超) → フル控除", () => {
    const eff = calcEffectiveYearsForLumpSum(60, 30, 66, 20, 5);
    expect(eff).toBe(20);
  });

  it("[境界5] gap=18 (19年未満) → overlap=min(30,20)-18=2, secondary effective=18", () => {
    const eff = calcEffectiveYearsForLumpSum(50, 30, 68, 20, 19);
    expect(eff).toBe(18);
  });

  it("[境界6] gap=19 (ちょうど) → フル控除", () => {
    const eff = calcEffectiveYearsForLumpSum(50, 30, 69, 20, 19);
    expect(eff).toBe(20);
  });

  it("[境界7] firstYears=0 (先発勤続なし) → overlap=0, secondary そのまま", () => {
    const eff = calcEffectiveYearsForLumpSum(60, 0, 60, 20, 5);
    expect(eff).toBe(20);
  });

  it("[境界8] secondaryYears=0 → 0 (それ以下にはならない)", () => {
    const eff = calcEffectiveYearsForLumpSum(60, 30, 60, 0, 5);
    expect(eff).toBe(0);
  });

  it("[境界9] 両方0年 → 0", () => {
    const eff = calcEffectiveYearsForLumpSum(60, 0, 60, 0, 5);
    expect(eff).toBe(0);
  });

  it("[境界10] gap=1, years equal (20/20) → overlap=19, secondary effective=1", () => {
    const eff = calcEffectiveYearsForLumpSum(60, 20, 61, 20, 5);
    expect(eff).toBe(1);
  });

  it("[境界11] gap=5, 短い勤続 (1/1) → フル控除", () => {
    const eff = calcEffectiveYearsForLumpSum(60, 1, 65, 1, 5);
    expect(eff).toBe(1);
  });

  it("[境界12] 負のgap (順序逆) → secondary そのまま (安全側)", () => {
    const eff = calcEffectiveYearsForLumpSum(65, 30, 60, 20, 5);
    expect(eff).toBe(20);
  });

  it("[境界13] secondaryYears=10 で gap=1 → overlap=min(20,10)-1=9, effective=1", () => {
    const eff = calcEffectiveYearsForLumpSum(60, 20, 61, 10, 5);
    expect(eff).toBe(1);
  });

  // ---- B) 5/19年ルール切替 (2件) ----

  it("[ruleYears] 同 gap でも ruleYears=5 と 19 で結果が異なる", () => {
    // gap=10
    const eff5 = calcEffectiveYearsForLumpSum(60, 30, 70, 20, 5); // フル (10≥5)
    const eff19 = calcEffectiveYearsForLumpSum(60, 30, 70, 20, 19); // 圧縮 (10<19)
    expect(eff5).toBe(20);
    expect(eff19).toBe(10); // overlap = min(30,20)-10 = 10, effective = 10
  });

  it("[ruleYears] gap=19 ぎりぎりで ruleYears=19 → フル", () => {
    const eff = calcEffectiveYearsForLumpSum(50, 30, 69, 20, 19);
    expect(eff).toBe(20);
  });

  // ---- C) Property (3件) ----

  it("[property] 戻り値は常に 0 以上", () => {
    const samples = [
      [60, 30, 60, 20, 5],
      [60, 100, 60, 1, 5],
      [60, 0, 60, 0, 5],
      [60, 30, 65, 20, 19],
    ];
    for (const [a, b, c, d, r] of samples) {
      const eff = calcEffectiveYearsForLumpSum(a, b, c, d, r as 5 | 19);
      expect(eff).toBeGreaterThanOrEqual(0);
    }
  });

  it("[property] 戻り値 ≤ secondaryYears (控除年数は元の値を超えない)", () => {
    for (const gap of [0, 1, 4, 5, 10, 19, 20]) {
      for (const sec of [5, 10, 20, 30]) {
        const eff5 = calcEffectiveYearsForLumpSum(60, 30, 60 + gap, sec, 5);
        expect(eff5).toBeLessThanOrEqual(sec);
        const eff19 = calcEffectiveYearsForLumpSum(60, 30, 60 + gap, sec, 19);
        expect(eff19).toBeLessThanOrEqual(sec);
      }
    }
  });

  it("[property] gap が増えると effective も単調増加 (圧縮が緩む)", () => {
    let prev = -1;
    for (const gap of [0, 1, 2, 3, 4, 5, 6]) {
      const eff = calcEffectiveYearsForLumpSum(60, 30, 60 + gap, 20, 5);
      expect(eff).toBeGreaterThanOrEqual(prev);
      prev = eff;
    }
  });
});

describe("v4.6.3: calcCombinedLumpSumNet (合算手取り)", () => {
  // ---- D) End-to-end 税額 (4件) ----

  it("[E2E1] gap=0 (同年受給) は重複控除で課税が増える", () => {
    const result = calcCombinedLumpSumNet(
      { amount: 8_000_000, receiveAge: 60, yearsOfContribution: 20 },
      { amount: 15_000_000, receiveAge: 60, yearsOfService: 30 },
    );
    expect(result.totalTax).toBeGreaterThan(0);
  });

  it("[E2E2] gap=5 はフル控除で gap=0 より税が少ない", () => {
    const gap0 = calcCombinedLumpSumNet(
      { amount: 8_000_000, receiveAge: 60, yearsOfContribution: 20 },
      { amount: 15_000_000, receiveAge: 60, yearsOfService: 30 },
    );
    const gap5 = calcCombinedLumpSumNet(
      { amount: 8_000_000, receiveAge: 60, yearsOfContribution: 20 },
      { amount: 15_000_000, receiveAge: 65, yearsOfService: 30 },
    );
    expect(gap5.totalTax).toBeLessThan(gap0.totalTax);
    expect(gap5.totalNet).toBeGreaterThan(gap0.totalNet);
  });

  it("[E2E3] gap=19 (退職金先) はフル控除で gap=0 より税が少ない", () => {
    // 退職金 60歳、iDeCo 79歳（gap=19）
    const gap0 = calcCombinedLumpSumNet(
      { amount: 8_000_000, receiveAge: 60, yearsOfContribution: 20 },
      { amount: 15_000_000, receiveAge: 60, yearsOfService: 30 },
    );
    const gap19 = calcCombinedLumpSumNet(
      { amount: 8_000_000, receiveAge: 79, yearsOfContribution: 20 },
      { amount: 15_000_000, receiveAge: 60, yearsOfService: 30 },
    );
    expect(gap19.totalTax).toBeLessThan(gap0.totalTax);
  });

  it("[E2E4] iDeCo 小額 (退職所得控除内) は gap 無関係に税ゼロ", () => {
    const gap0 = calcCombinedLumpSumNet(
      { amount: 500_000, receiveAge: 60, yearsOfContribution: 1 },
      { amount: 0, receiveAge: 60, yearsOfService: 0 },
    );
    expect(gap0.idecoTax).toBe(0);
    // 退職金0なので税0
    expect(gap0.bonusTax).toBe(0);
  });

  // ---- E) 受給順序の自動判定 ----

  it("[順序] iDeCo先発（idecoAge<bonusAge）は5年ルール適用", () => {
    // bonus 控除の圧縮を観測
    const result = calcCombinedLumpSumNet(
      { amount: 1_000_000, receiveAge: 60, yearsOfContribution: 20 }, // 先
      { amount: 30_000_000, receiveAge: 62, yearsOfService: 30 },    // 後 (gap=2)
    );
    // gap=2 で 5年ルール → bonus 効果年数 = 30 - (min(20,30)-2) = 30 - 18 = 12
    // 比較用: フル控除の手取り
    const fullDeduction = calcRetirementBonusNet(30_000_000, 30);
    expect(result.bonusTax).toBeGreaterThan(fullDeduction.tax);
  });

  it("[順序] 退職金先発（bonusAge<idecoAge）は19年ルール適用", () => {
    const result = calcCombinedLumpSumNet(
      { amount: 8_000_000, receiveAge: 65, yearsOfContribution: 20 }, // 後
      { amount: 15_000_000, receiveAge: 60, yearsOfService: 30 },    // 先 (gap=5)
    );
    // gap=5、19年ルール → ideco 効果年数 = 20 - (min(30,20)-5) = 20 - 15 = 5
    const fullDeduction = calcRetirementBonusNet(8_000_000, 20);
    expect(result.idecoTax).toBeGreaterThan(fullDeduction.tax);
  });
});

describe("v4.6.3: findOptimalIdecoLumpSumAge (最適探索)", () => {
  it("[最適] 退職金60歳・典型ケースでの最適 iDeCo 受給年は 60 + ruleYears 以降のフル控除域", () => {
    const result = findOptimalIdecoLumpSumAge(
      { amount: 8_000_000, yearsOfContribution: 20, currentReceiveAge: 60 },
      { amount: 15_000_000, receiveAge: 60, yearsOfService: 30 },
    );
    // 19年ルール適用 (退職金先) → 79歳以降がフル控除域
    expect(result.optimalAge).toBeGreaterThanOrEqual(75 - 1); // 探索範囲上限近く
    expect(result.optimalNet).toBeGreaterThanOrEqual(result.currentNet);
    expect(result.improvement).toBeGreaterThanOrEqual(0);
  });

  it("[最適] 同年受給 (gap=0) → 改善余地あり（improvement > 0）", () => {
    const result = findOptimalIdecoLumpSumAge(
      { amount: 8_000_000, yearsOfContribution: 20, currentReceiveAge: 60 },
      { amount: 15_000_000, receiveAge: 60, yearsOfService: 30 },
    );
    expect(result.improvement).toBeGreaterThan(0);
  });

  it("[最適] byAge 配列は探索範囲分の長さ", () => {
    const result = findOptimalIdecoLumpSumAge(
      { amount: 1_000_000, yearsOfContribution: 10, currentReceiveAge: 60 },
      { amount: 5_000_000, receiveAge: 60, yearsOfService: 20 },
      { from: 60, to: 70 },
    );
    expect(result.byAge.length).toBe(11);
    expect(result.byAge[0]?.age).toBe(60);
    expect(result.byAge[10]?.age).toBe(70);
  });

  it("[最適] iDeCo・退職金とも控除内 → improvement = 0 (どこでも税ゼロ)", () => {
    const result = findOptimalIdecoLumpSumAge(
      { amount: 500_000, yearsOfContribution: 1, currentReceiveAge: 60 },
      { amount: 0, receiveAge: 60, yearsOfService: 0 },
    );
    expect(result.improvement).toBe(0);
  });
});
