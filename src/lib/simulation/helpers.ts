import type { PensionInput, SimulationInput } from "./types";
import type { TaxCategory } from "@/lib/tax";
import type { CostBasis } from "./cost-basis";

/** 繰上げ受給: 1ヶ月あたり0.4%減額（国民年金法附則9条の2第4項） */
const PENSION_EARLY_RATE_PER_MONTH = 0.004;
/** 繰下げ受給: 1ヶ月あたり0.7%増額（国民年金法第28条第4項） */
const PENSION_LATE_RATE_PER_MONTH = 0.007;

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
    adjustmentRate = 1 - (65 - pension.startAge) * 12 * PENSION_EARLY_RATE_PER_MONTH;
  } else if (pension.startAge > 65) {
    adjustmentRate = 1 + (pension.startAge - 65) * 12 * PENSION_LATE_RATE_PER_MONTH;
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

/* ---------- 口座操作ヘルパー ---------- */

/** 口座群の可変状態 */
export interface MemberAccounts {
  nisa: number;
  tokutei: number;
  ideco: number;
  gold: number;
  cash: number;
  nisaCumulative: number;
  tokuteiCB: CostBasis;
  goldCB: CostBasis;
}

/**
 * 口座から赤字分を取り崩す（withdrawalOrder順、iDeCo年齢制約付き）
 * @returns 取り崩し合計額
 */
export function drawFromAccounts(
  accts: MemberAccounts,
  deficit: number,
  withdrawalOrder: TaxCategory[],
  age: number,
): number {
  let drawn = 0;
  let remaining = deficit;
  for (const cat of withdrawalOrder) {
    if (remaining <= 0) break;
    if (cat === "ideco" && age < 60) continue;
    const bal = getMemberBalance(accts, cat);
    if (bal <= 0) continue;
    const draw = Math.min(remaining, bal);
    // costBasis按分減少
    if (cat === "tokutei" && accts.tokutei > 0) accts.tokuteiCB.withdraw(draw, accts.tokutei);
    if (cat === "gold_physical" && accts.gold > 0) accts.goldCB.withdraw(draw, accts.gold);
    // 残高減算
    switch (cat) {
      case "nisa": accts.nisa -= draw; break;
      case "tokutei": accts.tokutei -= draw; break;
      case "ideco": accts.ideco -= draw; break;
      case "gold_physical": accts.gold -= draw; break;
      case "cash": accts.cash -= draw; break;
      default: assertNever(cat);
    }
    drawn += draw;
    remaining -= draw;
  }
  return drawn;
}

/**
 * 余剰を NISA → tokutei の順で積み立てる（簡易版: Spouse用）
 */
export function contributeSurplus(
  accts: MemberAccounts,
  surplus: number,
  nisaConfig?: { annualLimit: number; lifetimeLimit: number },
): void {
  if (nisaConfig) {
    const lifetimeRemaining = nisaConfig.lifetimeLimit - accts.nisaCumulative;
    const annualAllowance = Math.min(nisaConfig.annualLimit, Math.max(0, lifetimeRemaining));
    const toNisa = Math.min(surplus, annualAllowance);
    if (toNisa > 0) { accts.nisa += toNisa; accts.nisaCumulative += toNisa; }
    const toTokutei = surplus - toNisa;
    if (toTokutei > 0) { accts.tokutei += toTokutei; accts.tokuteiCB.contribute(toTokutei); }
  } else {
    accts.tokutei += surplus;
    accts.tokuteiCB.contribute(surplus);
  }
}

/** MemberAccounts からの残高取得 */
function getMemberBalance(accts: MemberAccounts, cat: TaxCategory): number {
  switch (cat) {
    case "nisa": return accts.nisa;
    case "tokutei": return accts.tokutei;
    case "ideco": return accts.ideco;
    case "gold_physical": return accts.gold;
    case "cash": return accts.cash;
    default: return assertNever(cat);
  }
}
