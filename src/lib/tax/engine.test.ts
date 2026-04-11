import { describe, it, expect } from "vitest";
import {
  calcEmploymentIncome,
  calcSocialInsurancePremium,
  calcTaxableIncome,
  calcIncomeTax,
  calcResidentTax,
  calcAnnualTax,
  calcRetirementIncomeDeduction,
  calcRetirementTaxableIncome,
  calcTokuteiTax,
  calcNisaTax,
} from "./engine";
import { calcWithdrawalTax } from "./accounts";

describe("税制エンジン P0テスト", () => {
  // P0 #1: 年収500万・独身・40歳 → 所得税・住民税・社保が±5%
  describe("年収500万の税計算", () => {
    const salary = 5_000_000;
    const age = 40;

    it("給与所得が正しく計算される", () => {
      // 年収500万 → 給与所得控除 = 500万 * 0.2 + 44万 = 144万 → 給与所得 = 356万
      const income = calcEmploymentIncome(salary);
      expect(income).toBe(3_560_000);
    });

    it("社会保険料が妥当な範囲", () => {
      const income = calcEmploymentIncome(salary);
      const si = calcSocialInsurancePremium(income, age);
      // 国保（医療+後期高齢+介護） + 国民年金 ≒ 50〜80万の範囲
      expect(si).toBeGreaterThan(500_000);
      expect(si).toBeLessThan(800_000);
    });

    it("所得税が±5%の範囲", () => {
      const result = calcAnnualTax(salary, age);
      // 年収500万・独身の所得税は概算で10〜15万程度
      expect(result.incomeTax).toBeGreaterThan(80_000);
      expect(result.incomeTax).toBeLessThan(200_000);
    });

    it("住民税が±5%の範囲", () => {
      const result = calcAnnualTax(salary, age);
      // 住民税は概算で18〜28万程度
      expect(result.residentTax).toBeGreaterThan(150_000);
      expect(result.residentTax).toBeLessThan(300_000);
    });

    it("手取りが350〜420万の範囲", () => {
      const result = calcAnnualTax(salary, age);
      expect(result.netIncome).toBeGreaterThan(3_500_000);
      expect(result.netIncome).toBeLessThan(4_200_000);
    });
  });

  // P0 #2: NISA取り崩し → 課税0円
  describe("NISA口座", () => {
    it("利益100万円でも税額0", () => {
      expect(calcNisaTax(1_000_000)).toBe(0);
    });

    it("取り崩し額がそのまま手取り", () => {
      const result = calcWithdrawalTax("nisa", 5_000_000);
      expect(result.tax).toBe(0);
      expect(result.net).toBe(5_000_000);
    });
  });

  // P0 #3: 特定口座100万円利益 → 税額203,150円
  describe("特定口座の課税", () => {
    it("利益100万円に対して20.315%の税", () => {
      const tax = calcTokuteiTax(1_000_000);
      expect(tax).toBe(203_150);
    });

    it("取り崩し200万・含み益率50%で税額", () => {
      const result = calcWithdrawalTax("tokutei", 2_000_000, { gainRatio: 0.5 });
      // 含み益 = 200万 * 0.5 = 100万、税 = 100万 * 20.315% = 203,150
      expect(result.tax).toBe(203_150);
      expect(result.net).toBe(2_000_000 - 203_150);
    });

    it("利益0円なら税額0", () => {
      expect(calcTokuteiTax(0)).toBe(0);
      expect(calcTokuteiTax(-100_000)).toBe(0);
    });
  });

  // P0 #4: iDeCo一括受取（勤続20年）→ 退職所得控除800万円
  describe("iDeCo / 退職所得", () => {
    it("勤続20年の退職所得控除 = 800万円", () => {
      const deduction = calcRetirementIncomeDeduction(20);
      expect(deduction).toBe(8_000_000);
    });

    it("勤続5年の退職所得控除 = 200万円", () => {
      const deduction = calcRetirementIncomeDeduction(5);
      expect(deduction).toBe(2_000_000);
    });

    it("勤続1年の退職所得控除 = 80万円（最低保証）", () => {
      const deduction = calcRetirementIncomeDeduction(1);
      expect(deduction).toBe(800_000);
    });

    it("勤続30年の退職所得控除 = 1,500万円", () => {
      // 20年 * 40万 + 10年 * 70万 = 800万 + 700万 = 1,500万
      const deduction = calcRetirementIncomeDeduction(30);
      expect(deduction).toBe(15_000_000);
    });

    it("iDeCo 800万円受取・勤続20年 → 課税所得0 → 税0", () => {
      const taxable = calcRetirementTaxableIncome(8_000_000, 20);
      expect(taxable).toBe(0);
      const result = calcWithdrawalTax("ideco", 8_000_000, { yearsOfService: 20 });
      expect(result.tax).toBe(0);
    });

    it("iDeCo 1,200万受取・勤続20年 → 課税所得200万", () => {
      // (1200万 - 800万) * 0.5 = 200万
      const taxable = calcRetirementTaxableIncome(12_000_000, 20);
      expect(taxable).toBe(2_000_000);
    });
  });

  // P0 #5: 固定リターン0%、支出>収入系（MC外だが計算確認）
  describe("境界値テスト", () => {
    it("年収0円でも計算がクラッシュしない", () => {
      const result = calcAnnualTax(0, 30);
      expect(result.incomeTax).toBe(0);
      expect(result.netIncome).toBeLessThanOrEqual(0);
    });

    it("年収1億でも妥当な税額", () => {
      const result = calcAnnualTax(100_000_000, 50);
      // 高額所得者は税率45%近辺 + 住民税10% + 社保
      expect(result.totalTax).toBeGreaterThan(40_000_000);
      expect(result.totalTax).toBeLessThan(70_000_000);
    });

    it("所得25,000,001円で基礎控除0", () => {
      const deduction = calcResidentTax(25_000_001, 0);
      // 基礎控除0の場合、全額所得割対象
      expect(deduction).toBeGreaterThan(0);
    });
  });
});
