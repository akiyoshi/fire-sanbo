import { describe, it, expect } from "vitest";
import {
  calcFurusatoLimit,
  calcAnnualTax,
  calcMarginalIncomeTaxRate,
} from "./engine";

/**
 * v4.6.1 (T-7): ふるさと納税の年間自己負担 2,000 円で済む寄附上限額。
 *
 * 総務省ポータル準拠の標準計算式:
 *   limit = (taxableIncome × 0.10 × 0.20) / (1 − marginalRate × 1.021 − 0.10) + 2000
 */

describe("v4.6.1: ふるさと納税上限 (calcFurusatoLimit)", () => {
  // ---- A) 境界テスト (5件) ----

  it("[境界] 課税所得 0 → 自己負担 2,000 円のみ", () => {
    expect(calcFurusatoLimit(0, 0.05)).toBe(2_000);
    expect(calcFurusatoLimit(0, 0.10)).toBe(2_000);
    expect(calcFurusatoLimit(-1, 0.05)).toBe(2_000); // 安全弁
  });

  it("[境界] 課税所得 195万・5%ブラケット", () => {
    // 分母 = 1 − 0.05 × 1.021 − 0.10 = 0.84895
    // limit = (1_950_000 × 0.10 × 0.20) / 0.84895 + 2000 ≈ 45,938 + 2000
    const limit = calcFurusatoLimit(1_950_000, 0.05);
    expect(limit).toBeGreaterThan(45_000);
    expect(limit).toBeLessThan(50_000);
  });

  it("[境界] 課税所得 330万・10%→20% ブラケット境界（10%側）", () => {
    // 分母 = 1 − 0.10 × 1.021 − 0.10 = 0.7979
    // limit ≈ 330万 × 0.02 / 0.7979 + 2000
    const limit = calcFurusatoLimit(3_300_000, 0.10);
    expect(limit).toBeGreaterThan(80_000);
    expect(limit).toBeLessThan(90_000);
  });

  it("[境界] 課税所得 695万・20%→23% ブラケット境界（20%側）", () => {
    const limit = calcFurusatoLimit(6_950_000, 0.20);
    expect(limit).toBeGreaterThan(190_000);
    expect(limit).toBeLessThan(220_000);
  });

  it("[境界] 高額（4,000万・45%）", () => {
    // 分母 = 1 − 0.45 × 1.021 − 0.10 = 0.44055
    const limit = calcFurusatoLimit(40_000_000, 0.45);
    expect(limit).toBeGreaterThan(1_500_000);
    expect(limit).toBeLessThan(2_000_000);
  });

  // ---- B) Property テスト (2件) ----

  it("[property] taxableIncome 単調増加 → limit も単調増加 (marginalRate 固定)", () => {
    const r = 0.20;
    const points = [100_000, 1_000_000, 5_000_000, 10_000_000, 20_000_000];
    const limits = points.map((x) => calcFurusatoLimit(x, r));
    for (let i = 1; i < limits.length; i++) {
      expect(limits[i]).toBeGreaterThan(limits[i - 1]!);
    }
  });

  it("[property] limit ≥ 自己負担 2,000 (常に下限)", () => {
    const samples: [number, number][] = [
      [0, 0],
      [0, 0.45],
      [10, 0.05],
      [10_000_000, 0.33],
    ];
    for (const [income, rate] of samples) {
      expect(calcFurusatoLimit(income, rate)).toBeGreaterThanOrEqual(2_000);
    }
  });

  // ---- C) `calcAnnualTax` への marginalRate 露出 (1件) ----

  it("[DRY] calcAnnualTax の戻り値だけで上限が算定可能（再計算不要）", () => {
    const tax = calcAnnualTax(6_000_000, 40);
    expect(tax.taxableIncome).toBeGreaterThan(0);
    expect(tax.marginalIncomeTaxRate).toBeGreaterThan(0);
    expect(tax.marginalIncomeTaxRate).toBeLessThanOrEqual(0.45);

    const limit = calcFurusatoLimit(tax.taxableIncome, tax.marginalIncomeTaxRate);
    // 給与600万・40歳の典型ケースで上限は5万〜10万円台
    expect(limit).toBeGreaterThan(40_000);
    expect(limit).toBeLessThan(150_000);
  });
});

describe("v4.6.1: 限界税率 (calcMarginalIncomeTaxRate)", () => {
  it("[境界] 0円 → 0%", () => {
    expect(calcMarginalIncomeTaxRate(0)).toBe(0);
    expect(calcMarginalIncomeTaxRate(-1)).toBe(0);
  });

  it("[境界] 195万円ちょうど → 5%", () => {
    expect(calcMarginalIncomeTaxRate(1_950_000)).toBe(0.05);
  });

  it("[境界] 195万+1円 → 10%", () => {
    expect(calcMarginalIncomeTaxRate(1_950_001)).toBe(0.10);
  });

  it("[境界] 4000万超 → 45%（最大ブラケット）", () => {
    expect(calcMarginalIncomeTaxRate(50_000_000)).toBe(0.45);
  });
});
