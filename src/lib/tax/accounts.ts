import { calcTokuteiTax, calcNisaTax, calcRetirementTaxableIncome, calcIncomeTax } from "./engine";
import type { TaxConfig } from "./types";
import defaultConfig from "@/config/tax-config-2026.json";

const config: TaxConfig = defaultConfig as TaxConfig;

export type AccountType = "nisa" | "tokutei" | "ideco";

export interface WithdrawalResult {
  gross: number;
  tax: number;
  net: number;
  accountType: AccountType;
}

/**
 * 口座種別に応じた取り崩し税額を計算
 */
export function calcWithdrawalTax(
  accountType: AccountType,
  amount: number,
  options?: {
    /** iDeCo一括受取時の勤続年数 */
    yearsOfService?: number;
    /** 特定口座の含み益率 (0-1) */
    gainRatio?: number;
  },
  cfg = config
): WithdrawalResult {
  switch (accountType) {
    case "nisa": {
      return { gross: amount, tax: calcNisaTax(amount), net: amount, accountType };
    }
    case "tokutei": {
      const gainRatio = options?.gainRatio ?? 0.5;
      const gain = Math.floor(amount * gainRatio);
      const tax = calcTokuteiTax(gain, cfg);
      return { gross: amount, tax, net: amount - tax, accountType };
    }
    case "ideco": {
      const years = options?.yearsOfService ?? 20;
      const taxableIncome = calcRetirementTaxableIncome(amount, years, cfg);
      const tax = calcIncomeTax(taxableIncome, cfg);
      return { gross: amount, tax, net: amount - tax, accountType };
    }
  }
}
