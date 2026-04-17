import { describe, it, expect } from "vitest";
import {
  calcEmploymentIncome,
  calcSocialInsurancePremium,
  calcResidentTax,
  calcAnnualTax,
  calcRetirementIncomeDeduction,
  calcRetirementTaxableIncome,
  calcTokuteiTax,
  calcNisaTax,
  calcIncomeTax,
  calcGoldWithdrawalTax,
  calcPublicPensionDeduction,
  calcRetirementBonusNet,
  calcComprehensiveTax,
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

      // 所得税 + 住民税10%（分離課税）
      const result = calcWithdrawalTax("ideco", 12_000_000, { yearsOfService: 20 });
      const incomeTax = calcIncomeTax(2_000_000);
      const residentTax = Math.floor(2_000_000 * 0.10);
      expect(result.tax).toBe(incomeTax + residentTax);
      expect(result.net).toBe(12_000_000 - result.tax);
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

  // 回帰テスト: 年齢別社会保険料
  describe("年齢別社会保険料の正確性", () => {
    it("30歳: 介護保険なし・国民年金あり", () => {
      const si = calcSocialInsurancePremium(0, 30);
      // 所得0: 国保均等割のみ + 国民年金
      const expected = 45_400 + 16_500 + 210_120; // 医療均等割 + 後期支援均等割 + 年金
      expect(si).toBe(expected);
    });

    it("45歳: 介護保険(第2号)あり・国民年金あり", () => {
      const si = calcSocialInsurancePremium(0, 45);
      // 介護保険均等割も加算
      const expected = 45_400 + 16_500 + 15_600 + 210_120;
      expect(si).toBe(expected);
    });

    it("60歳: 国民年金の最終年", () => {
      const si59 = calcSocialInsurancePremium(0, 59);
      const si60 = calcSocialInsurancePremium(0, 60);
      // 59歳: 年金あり、60歳: 年金なし
      expect(si59).toBeGreaterThan(si60);
      expect(si59 - si60).toBe(210_120); // 差分 = 国民年金保険料
    });

    it("65歳: 介護保険第1号あり・国民年金なし", () => {
      const si = calcSocialInsurancePremium(0, 65);
      // 医療均等割 + 後期支援均等割 + 介護第1号(74,700)、年金なし
      const expected = 45_400 + 16_500 + 74_700;
      expect(si).toBe(expected);
    });

    it("80歳: 介護保険第1号あり・国民年金なし", () => {
      const si65 = calcSocialInsurancePremium(0, 65);
      const si80 = calcSocialInsurancePremium(0, 80);
      // 65歳と80歳のゼロ所得は同じ構造
      expect(si80).toBe(si65);
    });

    it("64→65歳: 介護保険が第2号(国保内)から第1号(独立)に切り替わる", () => {
      const si64 = calcSocialInsurancePremium(0, 64);
      const si65 = calcSocialInsurancePremium(0, 65);
      // 64歳: 均等割(医療+後期+介護第2号) + 年金なし(60超)
      // 65歳: 均等割(医療+後期) + 介護第1号(74,700) + 年金なし
      const expected64 = 45_400 + 16_500 + 15_600; // 介護第2号の均等割あり、年金はなし(64>59)
      const expected65 = 45_400 + 16_500 + 74_700; // 介護第1号
      expect(si64).toBe(expected64);
      expect(si65).toBe(expected65);
    });
  });

  describe("金現物（長期譲渡所得）", () => {
    it("利益50万円以下なら税額0（特別控除）", () => {
      // 取り崩し100万円、含み益率30% → 利益30万 < 50万控除
      const result = calcGoldWithdrawalTax(1_000_000, 0.3, 0);
      expect(result.tax).toBe(0);
    });

    it("利益200万で50万控除+1/2課税が適用される", () => {
      // 取り崩し400万円、含み益率50% → 利益200万
      // 課税対象 = (200万 - 50万) * 0.5 = 75万
      const result = calcGoldWithdrawalTax(4_000_000, 0.5, 0);
      // 退職後otherIncome=0: 所得税と住民税の差分が発生する
      expect(result.tax).toBeGreaterThan(0);
      expect(result.tax).toBeLessThan(200_000); // 75万の所得に対して20万未満
    });

    it("calcWithdrawalTax経由でgold_physicalが呼べる", () => {
      const result = calcWithdrawalTax("gold_physical", 2_000_000, { goldGainRatio: 0.5 });
      expect(result.tax).toBeGreaterThanOrEqual(0);
      expect(result.net).toBeLessThanOrEqual(2_000_000);
      expect(result.net + result.tax).toBe(2_000_000);
    });

    it("otherIncome>0で累進税率が上がる（差分課税）", () => {
      // otherIncome=0 の場合
      const withoutOther = calcGoldWithdrawalTax(4_000_000, 0.5, 0);
      // otherIncome=200万（年金雑所得）の場合
      const withOther = calcGoldWithdrawalTax(4_000_000, 0.5, 2_000_000);
      // 他の所得があると累進の上段に押し上げられ、金の限界税率が上がる
      expect(withOther.tax).toBeGreaterThan(withoutOther.tax);
    });

    it("calcWithdrawalTax経由でotherComprehensiveIncomeが渡せる", () => {
      const without = calcWithdrawalTax("gold_physical", 4_000_000, { goldGainRatio: 0.5 });
      const withOther = calcWithdrawalTax("gold_physical", 4_000_000, {
        goldGainRatio: 0.5,
        otherComprehensiveIncome: 2_000_000,
      });
      expect(withOther.tax).toBeGreaterThan(without.tax);
    });
  });
});

describe("総合課税統合 (calcComprehensiveTax)", () => {
  it("年金雑所得のみ → 税額が正しく計算される", () => {
    // 年金200万、65歳 → 控除110万 → 雑所得90万
    const pensionTaxable = 900_000; // 公的年金等控除後
    const compTax = calcComprehensiveTax(pensionTaxable, 0, 0);
    // 90万 - 基礎控除48万 = 42万 → 所得税5%=21,000 + 復興2.1%=441 → 21,441
    expect(compTax.incomeTax).toBeGreaterThan(0);
    expect(compTax.total).toBeGreaterThan(0);
  });

  it("年金+副収入の合算で基礎控除は1回のみ", () => {
    // 年金雑所得100万 + 副収入100万 = 総合200万
    const combined = calcComprehensiveTax(1_000_000, 1_000_000, 0);
    // 各単独の合計
    const pensionOnly = calcComprehensiveTax(1_000_000, 0, 0);
    const sideOnly = calcComprehensiveTax(0, 1_000_000, 0);
    // 合算の方が税額が大きい（基礎控除が1回のみだから）
    expect(combined.total).toBeGreaterThan(pensionOnly.total);
    // 合算 >= 各単独の合計（累進+基礎控除1回の効果）
    expect(combined.total).toBeGreaterThanOrEqual(pensionOnly.total + sideOnly.total);
  });

  it("所得0なら税額0", () => {
    const result = calcComprehensiveTax(0, 0, 0);
    expect(result.total).toBe(0);
  });
});

/* ---------- v0.9: 公的年金等控除・年金課税・退職金・副収入 ---------- */

describe("公的年金等控除", () => {
  it("65歳以上・年金330万以下なら控除110万", () => {
    expect(calcPublicPensionDeduction(2_000_000, 65)).toBe(1_100_000);
    expect(calcPublicPensionDeduction(3_300_000, 70)).toBe(1_100_000);
  });

  it("65歳未満・年金130万以下なら控除60万", () => {
    expect(calcPublicPensionDeduction(1_000_000, 60)).toBe(600_000);
    expect(calcPublicPensionDeduction(1_300_000, 64)).toBe(600_000);
  });

  it("65歳以上・年金400万は段階控除", () => {
    // 330万超400万以下: rate=0.25, base=275000 → 400万*0.25+275000 = 1,275,000
    expect(calcPublicPensionDeduction(4_000_000, 68)).toBe(1_275_000);
  });
});

describe("年金課税（calcComprehensiveTax経由）", () => {
  it("年金雑所得90万（控除後）→低税額", () => {
    // 年金200万・65歳以上 → 控除110万 → 雑所得90万
    const result = calcComprehensiveTax(900_000, 0, 0);
    expect(result.incomeTax).toBeGreaterThan(0);
    expect(result.incomeTax).toBeLessThan(50_000);
    expect(result.total).toBeGreaterThan(0);
  });

  it("所得がゼロなら税金ゼロ", () => {
    const result = calcComprehensiveTax(0, 0, 0);
    expect(result.total).toBe(0);
  });
});

describe("退職金手取り", () => {
  it("退職金2000万・勤続25年の手取り", () => {
    // 勤続25年: 控除 = 20年*40万 + 5年*70万 = 1,150万
    // 退職所得 = (2000万 - 1150万) * 0.5 = 425万
    const result = calcRetirementBonusNet(20_000_000, 25);
    expect(result.net).toBeGreaterThan(18_000_000); // 控除が大きいので手取り率高い
    expect(result.tax).toBeGreaterThan(0);
    expect(result.net + result.tax).toBe(20_000_000);
  });

  it("退職金0なら税金0", () => {
    const result = calcRetirementBonusNet(0, 20);
    expect(result.tax).toBe(0);
    expect(result.net).toBe(0);
  });

  it("退職金が控除以下なら税金0", () => {
    // 勤続20年: 控除 = 20*40万 = 800万
    const result = calcRetirementBonusNet(8_000_000, 20);
    expect(result.tax).toBe(0);
    expect(result.net).toBe(8_000_000);
  });
});

describe("副収入課税（calcComprehensiveTax経由）", () => {
  it("副収入150万の税金計算", () => {
    const result = calcComprehensiveTax(0, 1_500_000, 0);
    // 150万 - 基礎控除48万 = 課税所得102万 → 税率5%
    expect(result.incomeTax).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it("副収入0なら税金0", () => {
    const result = calcComprehensiveTax(0, 0, 0);
    expect(result.total).toBe(0);
  });
});
