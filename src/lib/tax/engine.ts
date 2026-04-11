import type { TaxConfig } from "./types";
import defaultConfig from "@/config/tax-config-2026.json";

const config: TaxConfig = defaultConfig as TaxConfig;

/**
 * 給与所得控除を計算
 */
export function calcEmploymentIncomeDeduction(
  salary: number,
  cfg = config
): number {
  for (const t of cfg.incomeTax.employmentIncomeDeduction.thresholds) {
    if (t.maxIncome === null || salary <= t.maxIncome) {
      if (t.deduction !== undefined) return t.deduction;
      // rate * salary - subtract
      return Math.floor(salary * t.rate! + (t.subtract ?? 0));
    }
  }
  return 0;
}

/**
 * 給与収入 → 給与所得
 */
export function calcEmploymentIncome(salary: number, cfg = config): number {
  return Math.max(0, salary - calcEmploymentIncomeDeduction(salary, cfg));
}

/**
 * 所得に応じた基礎控除（所得税用）
 */
export function calcBasicDeduction(totalIncome: number, cfg = config): number {
  for (const t of cfg.incomeTax.basicDeduction.thresholds) {
    if (t.maxIncome === null || totalIncome <= t.maxIncome) {
      return t.deduction;
    }
  }
  return 0;
}

/**
 * 所得に応じた基礎控除（住民税用）
 */
export function calcResidentBasicDeduction(
  totalIncome: number,
  cfg = config
): number {
  for (const t of cfg.residentTax.basicDeduction.thresholds) {
    if (t.maxIncome === null || totalIncome <= t.maxIncome) {
      return t.deduction;
    }
  }
  return 0;
}

/**
 * 社会保険料控除（国保 + 国民年金）
 */
export function calcSocialInsurancePremium(
  totalIncome: number,
  age: number,
  cfg = config
): number {
  const nhi = cfg.socialInsurance.nationalHealthInsurance;
  const base = Math.max(0, totalIncome - nhi.baseDeduction);

  let medical = Math.min(
    Math.floor(base * nhi.medical.incomeRate) + nhi.medical.perCapita,
    nhi.medical.cap
  );
  let support = Math.min(
    Math.floor(base * nhi.support.incomeRate) + nhi.support.perCapita,
    nhi.support.cap
  );
  let longTermCare = 0;

  if (age >= (nhi.longTermCare.minAge ?? 40) && age <= (nhi.longTermCare.maxAge ?? 64)) {
    longTermCare = Math.min(
      Math.floor(base * nhi.longTermCare.incomeRate) + nhi.longTermCare.perCapita,
      nhi.longTermCare.cap
    );
  }

  // 65歳以上: 介護保険第1号被保険者（市区町村基準額）
  let longTermCareCat1 = 0;
  const cat1 = nhi.longTermCareCategory1;
  if (cat1 && age >= cat1.minAge) {
    longTermCareCat1 = cat1.annualPremium;
  }

  const nhiTotal = Math.min(medical + support + longTermCare, nhi.totalCap);

  // 国民年金: 60歳未満のみ（第1号被保険者の加入期間は20〜59歳）
  const pensionCfg = cfg.socialInsurance.nationalPension;
  const pensionMaxAge = pensionCfg.maxAge ?? 59;
  const pension = age <= pensionMaxAge ? pensionCfg.annualPremium : 0;

  return nhiTotal + longTermCareCat1 + pension;
}

/**
 * 課税所得を計算（所得税用）
 * 所得 - 基礎控除 - 社会保険料控除
 */
export function calcTaxableIncome(
  totalIncome: number,
  socialInsuranceDeduction: number,
  cfg = config
): number {
  const basicDeduction = calcBasicDeduction(totalIncome, cfg);
  return Math.max(
    0,
    Math.floor(totalIncome - basicDeduction - socialInsuranceDeduction)
  );
}

/**
 * 所得税額を計算（累進課税 + 復興特別所得税）
 */
export function calcIncomeTax(taxableIncome: number, cfg = config): number {
  let tax = 0;
  for (const bracket of cfg.incomeTax.brackets) {
    if (taxableIncome <= 0) break;
    if (bracket.to !== null && taxableIncome > bracket.to) continue;
    tax = Math.floor(taxableIncome * bracket.rate - bracket.deduction);
    break;
  }
  tax = Math.max(0, tax);
  // 復興特別所得税
  const surtax = Math.floor(tax * cfg.incomeTax.reconstructionSurtaxRate);
  return tax + surtax;
}

/**
 * 住民税額を計算（所得割 + 均等割）
 */
export function calcResidentTax(
  totalIncome: number,
  socialInsuranceDeduction: number,
  cfg = config
): number {
  const basicDeduction = calcResidentBasicDeduction(totalIncome, cfg);
  const taxableIncome = Math.max(
    0,
    Math.floor(totalIncome - basicDeduction - socialInsuranceDeduction)
  );
  const incomeComponent = Math.floor(taxableIncome * cfg.residentTax.incomeRate);
  const perCapita =
    cfg.residentTax.perCapita + cfg.residentTax.forestEnvironmentTax;
  return incomeComponent + perCapita;
}

/**
 * 退職所得控除を計算
 */
export function calcRetirementIncomeDeduction(
  yearsOfService: number,
  cfg = config
): number {
  const r = cfg.incomeTax.retirementIncomeDeduction;
  if (yearsOfService <= r.yearsThreshold) {
    return Math.max(r.minimumDeduction, yearsOfService * r.belowThresholdPerYear);
  }
  return (
    r.yearsThreshold * r.belowThresholdPerYear +
    (yearsOfService - r.yearsThreshold) * r.aboveThresholdPerYear
  );
}

/**
 * 退職所得（iDeCo一括受取時）
 */
export function calcRetirementTaxableIncome(
  lumpSum: number,
  yearsOfService: number,
  cfg = config
): number {
  const deduction = calcRetirementIncomeDeduction(yearsOfService, cfg);
  const r = cfg.incomeTax.retirementIncomeDeduction;
  return Math.max(0, Math.floor((lumpSum - deduction) * r.taxableRatio));
}

/**
 * 特定口座の譲渡益に対する税額
 */
export function calcTokuteiTax(gain: number, cfg = config): number {
  if (gain <= 0) return 0;
  return Math.floor(gain * cfg.investmentTax.tokuteiRate);
}

/**
 * NISA口座の譲渡益に対する税額（常に0）
 */
export function calcNisaTax(_gain: number): number {
  return 0;
}

export interface AnnualTaxResult {
  employmentIncome: number;
  socialInsurance: number;
  incomeTax: number;
  residentTax: number;
  totalTax: number;
  netIncome: number;
}

/**
 * 給与収入に対する年間の税金・社保・手取りを一括計算
 */
export function calcAnnualTax(
  salary: number,
  age: number,
  cfg = config
): AnnualTaxResult {
  const employmentIncome = calcEmploymentIncome(salary, cfg);
  const socialInsurance = calcSocialInsurancePremium(employmentIncome, age, cfg);
  const taxableIncome = calcTaxableIncome(employmentIncome, socialInsurance, cfg);
  const incomeTax = calcIncomeTax(taxableIncome, cfg);
  const residentTax = calcResidentTax(employmentIncome, socialInsurance, cfg);
  const totalTax = incomeTax + residentTax + socialInsurance;
  const netIncome = salary - totalTax;

  return {
    employmentIncome,
    socialInsurance,
    incomeTax,
    residentTax,
    totalTax,
    netIncome,
  };
}
