import type { MemberAccounts } from "./helpers";
import { assertNever, getAccountBalance } from "./helpers";
import type { TaxCategory } from "@/lib/tax";
import { calcWithdrawalTax, calcGoldTaxableIncome } from "@/lib/tax";

export interface WithdrawalTaxOpts {
  yearsOfService: number;
  comprehensiveIncome: number;
}

export interface WithdrawalResult {
  drawn: number;
  taxTotal: number;
  comprehensiveIncome: number;
}

/**
 * 退職後の課税考慮取り崩し。
 * simulation/engine.ts と prescription/engine.ts の共通ロジック。
 *
 * accts を直接変更する（mutable）。
 */
export function withdrawFromMember(
  accts: MemberAccounts,
  deficit: number,
  withdrawalOrder: TaxCategory[],
  age: number,
  txOpts: WithdrawalTaxOpts,
): WithdrawalResult {
  let drawn = 0;
  let taxTotal = 0;
  let remaining = deficit;
  let { comprehensiveIncome } = txOpts;

  for (const taxCategory of withdrawalOrder) {
    if (remaining <= 0) break;

    // iDeCoは60歳未満では取り崩し不可（確定拠出年金法）
    if (taxCategory === "ideco" && age < 60) continue;

    const balance = getAccountBalance(
      taxCategory,
      accts.nisa, accts.tokutei, accts.ideco, accts.gold, accts.cash,
    );
    if (balance <= 0) continue;

    const withdrawAmount = Math.min(remaining, balance);
    const result = calcWithdrawalTax(taxCategory, withdrawAmount, {
      yearsOfService: txOpts.yearsOfService,
      gainRatio: accts.tokuteiCB.gainRatio(accts.tokutei),
      goldGainRatio: accts.goldCB.gainRatio(accts.gold),
      otherComprehensiveIncome: comprehensiveIncome,
    });

    // 取得費を按分で減少
    if (taxCategory === "tokutei" && accts.tokutei > 0) {
      accts.tokuteiCB.withdraw(withdrawAmount, accts.tokutei);
    }

    // 金取り崩し: 取得費按分減少 + comprehensiveIncome累積
    if (taxCategory === "gold_physical" && accts.gold > 0) {
      const goldGainRatio = accts.goldCB.gainRatio(accts.gold);
      accts.goldCB.withdraw(withdrawAmount, accts.gold);
      const goldGain = withdrawAmount * goldGainRatio;
      const goldTaxable = calcGoldTaxableIncome(goldGain);
      comprehensiveIncome += goldTaxable;
    }

    // 残高減算
    switch (taxCategory) {
      case "nisa": accts.nisa -= withdrawAmount; break;
      case "tokutei": accts.tokutei -= withdrawAmount; break;
      case "ideco": accts.ideco -= withdrawAmount; break;
      case "gold_physical": accts.gold -= withdrawAmount; break;
      case "cash": accts.cash -= withdrawAmount; break;
      default: assertNever(taxCategory);
    }

    drawn += withdrawAmount;
    taxTotal += result.tax;
    remaining -= result.net;
  }

  return { drawn, taxTotal, comprehensiveIncome };
}
