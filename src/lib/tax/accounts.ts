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
    /** 金の総合課税計算用: 他の総合課税所得（年金雑所得+副収入） */
    otherComprehensiveIncome?: number;
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
      const otherIncome = options?.otherComprehensiveIncome ?? 0;
      const result = calcGoldWithdrawalTax(amount, goldGainRatio, otherIncome, cfg);
      return { gross: amount, tax: result.tax, net: amount - result.tax, taxCategory };
    }
    case "cash": {
      // 現金・預金: 取り崩し時に税金なし
      return { gross: amount, tax: 0, net: amount, taxCategory };
    }
    default:
      return assertNever(taxCategory);
  }
}
