import type { PensionInput, SimulationInput } from "./types";
import type { TaxCategory } from "@/lib/tax";

export function assertNever(x: never): never {
  throw new Error(`Unexpected tax category: ${x}`);
}

/**
 * 年金の年間受給額を計算（繰上げ/繰下げ調整込み）
 */
export function calcAnnualPension(pension: PensionInput | undefined, age: number): number {
  if (!pension) return 0;
  if (age < pension.startAge) return 0;

  const monthlyBase = pension.kosei + pension.kokumin;
  let adjustmentRate = 1.0;

  if (pension.startAge < 65) {
    adjustmentRate = 1 - (65 - pension.startAge) * 12 * 0.004;
  } else if (pension.startAge > 65) {
    adjustmentRate = 1 + (pension.startAge - 65) * 12 * 0.007;
  }

  return Math.round(monthlyBase * 12 * adjustmentRate);
}

/**
 * ライフイベントの一時支出を計算
 */
export function calcLifeEventExpense(lifeEvents: SimulationInput["lifeEvents"], age: number): number {
  if (!lifeEvents) return 0;
  return lifeEvents
    .filter((e) => e.age === age)
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * 口座種別に対応する残高を取得
 */
export function getAccountBalance(
  type: TaxCategory,
  nisa: number,
  tokutei: number,
  ideco: number,
  gold_physical: number,
  cash: number,
): number {
  switch (type) {
    case "nisa":
      return nisa;
    case "tokutei":
      return tokutei;
    case "ideco":
      return ideco;
    case "gold_physical":
      return gold_physical;
    case "cash":
      return cash;
    default:
      return assertNever(type);
  }
}
