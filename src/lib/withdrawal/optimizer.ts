import { runSimulation } from "@/lib/simulation";
import type { SimulationInput, SimulationResult } from "@/lib/simulation";
import type { AccountType } from "@/lib/tax";

/** 取り崩し順序の全パターン（3! = 6通り） */
const ALL_WITHDRAWAL_ORDERS: AccountType[][] = [
  ["nisa", "tokutei", "ideco"],
  ["nisa", "ideco", "tokutei"],
  ["tokutei", "nisa", "ideco"],
  ["tokutei", "ideco", "nisa"],
  ["ideco", "nisa", "tokutei"],
  ["ideco", "tokutei", "nisa"],
];

export interface WithdrawalOrderResult {
  order: AccountType[];
  label: string;
  successRate: number;
  medianFinalAssets: number;
}

export interface OptimizationResult {
  best: WithdrawalOrderResult;
  worst: WithdrawalOrderResult;
  all: WithdrawalOrderResult[];
  /** 最適 vs 最悪の最終資産差（中央値） */
  benefitAmount: number;
}

function orderLabel(order: AccountType[]): string {
  const names: Record<AccountType, string> = {
    nisa: "NISA",
    tokutei: "特定",
    ideco: "iDeCo",
  };
  return order.map((a) => names[a]).join(" → ");
}

/**
 * 全6パターンの取り崩し順序を評価し、最適順序を提案
 */
export function optimizeWithdrawalOrder(
  baseInput: SimulationInput
): OptimizationResult {
  const results: WithdrawalOrderResult[] = ALL_WITHDRAWAL_ORDERS.map(
    (order) => {
      const input: SimulationInput = { ...baseInput, withdrawalOrder: order };
      const sim = runSimulation(input);
      const lastIdx = sim.ages.length - 1;
      return {
        order,
        label: orderLabel(order),
        successRate: sim.successRate,
        medianFinalAssets: sim.percentiles.p50[lastIdx],
      };
    }
  );

  // 成功率 > 最終資産の順でソート
  results.sort((a, b) => {
    if (a.successRate !== b.successRate)
      return b.successRate - a.successRate;
    return b.medianFinalAssets - a.medianFinalAssets;
  });

  const best = results[0];
  const worst = results[results.length - 1];

  return {
    best,
    worst,
    all: results,
    benefitAmount: best.medianFinalAssets - worst.medianFinalAssets,
  };
}
