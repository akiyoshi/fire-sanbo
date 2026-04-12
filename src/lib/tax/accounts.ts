import { calcTokuteiTax, calcNisaTax, calcRetirementTaxableIncome, calcIncomeTax, calcGoldWithdrawalTax } from "./engine";
import type { TaxConfig } from "./types";
import type { TaxCategory } from "@/lib/portfolio/types";
import defaultConfig from "@/config/tax-config-2026.json";

const config: TaxConfig = defaultConfig as TaxConfig;

export type { TaxCategory };

export interface WithdrawalResult {
  gross: number;
  tax: number;
  net: number;
  taxCategory: TaxCategory;
}

function assertNever(x: never): never {
  throw new Error(`Unexpected tax category: ${x}`);
}

/**
 * 課税種別に応じた取り崩し税額を計算
 */
export function calcWithdrawalTax(
  taxCategory: TaxCategory,
  amount: number,
  options?: {
    /** iDeCo一括受取時の勤続年数 */
    yearsOfService?: number;
    /** 特定口座の含み益率 (0-1) */
    gainRatio?: number;
    /** 金現物の含み益率 (0-1) */
    goldGainRatio?: number;
  },
  cfg = config
): WithdrawalResult {
  switch (taxCategory) {
    case "nisa": {
      return { gross: amount, tax: calcNisaTax(amount), net: amount, taxCategory };
    }
    case "tokutei": {
      const gainRatio = options?.gainRatio ?? 0.5;
      const gain = Math.floor(amount * gainRatio);
      const tax = calcTokuteiTax(gain, cfg);
      return { gross: amount, tax, net: amount - tax, taxCategory };
    }
    case "ideco": {
      const years = options?.yearsOfService ?? 20;
      const taxableIncome = calcRetirementTaxableIncome(amount, years, cfg);
      const tax = calcIncomeTax(taxableIncome, cfg);
      return { gross: amount, tax, net: amount - tax, taxCategory };
    }
    case "gold_physical": {
      const goldGainRatio = options?.goldGainRatio ?? 0.3;
      // 退職後の他の総合課税所得は0（B1設計決定）
      const result = calcGoldWithdrawalTax(amount, goldGainRatio, 0, cfg);
      return { gross: amount, tax: result.tax, net: amount - result.tax, taxCategory };
    }
    default:
      return assertNever(taxCategory);
  }
}
