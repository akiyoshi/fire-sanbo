export {
  calcEmploymentIncomeDeduction,
  calcEmploymentIncome,
  calcBasicDeduction,
  calcResidentBasicDeduction,
  calcSocialInsurancePremium,
  calcTaxableIncome,
  calcIncomeTax,
  calcResidentTax,
  calcRetirementIncomeDeduction,
  calcRetirementTaxableIncome,
  calcTokuteiTax,
  calcNisaTax,
  calcAnnualTax,
} from "./engine";
export type { AnnualTaxResult } from "./engine";

export { calcWithdrawalTax } from "./accounts";
export type { AccountType, WithdrawalResult } from "./accounts";

export type { TaxConfig } from "./types";
