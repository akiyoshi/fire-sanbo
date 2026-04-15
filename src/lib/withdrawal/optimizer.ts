import { runSimulation } from "@/lib/simulation";
import type { SimulationInput } from "@/lib/simulation";
import type { TaxCategory } from "@/lib/tax";

/** 取り崩し順序の全パターン（4! = 24通り） */
function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

function getActiveCategories(input: SimulationInput): TaxCategory[] {
  const categories: TaxCategory[] = [];
  if (input.accounts.nisa > 0) categories.push("nisa");
  // 勤労期間中に余剰が特定口座に蓄積されるため、勤労期間があれば常に含める
  const hasWorkingYears = input.retirementAge > input.currentAge && input.annualSalary > 0;
  if (input.accounts.tokutei > 0 || hasWorkingYears) categories.push("tokutei");
  if (input.accounts.ideco > 0) categories.push("ideco");
  if (input.accounts.gold_physical > 0) categories.push("gold_physical");
  if (input.accounts.cash > 0) categories.push("cash");
  return categories;
}

export interface WithdrawalOrderResult {
  order: TaxCategory[];
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

export interface OptimizeOptions {
  /** true: numTrials=1, stdDev=0 の決定論的シナリオで比較（<50ms） */
  deterministic?: boolean;
}

function orderLabel(order: TaxCategory[]): string {
  const names: Record<TaxCategory, string> = {
    nisa: "NISA",
    tokutei: "特定",
    ideco: "iDeCo",
    gold_physical: "金現物",
    cash: "現金",
  };
  return order.map((a) => names[a]).join(" → ");
}

/**
 * 全パターンの取り崩し順序を評価し、最適順序を提案
 */
export function optimizeWithdrawalOrder(
  baseInput: SimulationInput,
  options?: OptimizeOptions
): OptimizationResult {
  const { deterministic = false } = options ?? {};
  const active = getActiveCategories(baseInput);
  // cashは末尾固定（リターン0・非課税なので順序の影響が小さい）
  const permutable = active.filter((c) => c !== "cash");
  const hasCash = active.includes("cash");
  const allOrders =
    permutable.length > 0
      ? permutations(permutable).map((order) =>
          hasCash ? [...order, "cash" as TaxCategory] : order
        )
      : [baseInput.withdrawalOrder];

  const results: WithdrawalOrderResult[] = allOrders.map(
    (order) => {
      const input: SimulationInput = {
        ...baseInput,
        withdrawalOrder: order,
        ...(deterministic && {
          numTrials: 1,
          seed: 0,
          allocation: {
            ...baseInput.allocation,
            standardDeviation: 0,
          },
          // 配偶者のstdDevも0にする（決定論的比較の公平性）
          ...(baseInput.spouse && {
            spouse: {
              ...baseInput.spouse,
              allocation: {
                ...baseInput.spouse.allocation,
                standardDeviation: 0,
              },
            },
          }),
        }),
      };
      const sim = runSimulation(input);
      const lastIdx = sim.ages.length - 1;
      return {
        order,
        label: orderLabel(order),
        successRate: sim.successRate,
        medianFinalAssets: deterministic
          ? sim.trials[0].finalAssets
          : sim.percentiles.p50[lastIdx],
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
