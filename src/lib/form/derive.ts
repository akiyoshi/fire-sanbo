import type { SimulationInput } from "@/lib/simulation";
import type { PortfolioEntry, TaxCategory, TargetAllocation, AssetClassId } from "@/lib/portfolio";
import type { AssetAllocation } from "@/lib/simulation";
import type { SpouseInput } from "@/lib/simulation";
import { calcPortfolio, calcFromWeights } from "@/lib/portfolio";
import type { FormState, SpouseFormState } from "./types";
import { VALID_TAX_CATEGORIES } from "./types";

/** NaN/undefined/負値を安全な値に変換 */
function safeNum(v: unknown, fallback = 0, min = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, n);
}

/** ポートフォリオから課税種別ごとの残高を集計 */
export function deriveBalancesByTaxCategory(portfolio: PortfolioEntry[]): Record<TaxCategory, number> {
  const result: Record<TaxCategory, number> = { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0 };
  for (const entry of portfolio) {
    if (entry.taxCategory in result) {
      result[entry.taxCategory] += entry.amount;
    }
  }
  return result;
}

/** 口座別のアロケーション（リターン・リスク）を導出 */
export function deriveAccountAllocations(
  portfolio: PortfolioEntry[]
): Partial<Record<TaxCategory, AssetAllocation>> | undefined {
  const categories: TaxCategory[] = ["nisa", "tokutei", "ideco", "gold_physical", "cash"];
  const result: Partial<Record<TaxCategory, AssetAllocation>> = {};
  let hasAny = false;

  for (const cat of categories) {
    if (cat === "cash") {
      result.cash = { expectedReturn: 0, standardDeviation: 0 };
      continue;
    }
    const entries = portfolio.filter((e) => e.taxCategory === cat && e.amount > 0);
    if (entries.length === 0) continue;
    const pr = calcPortfolio(entries);
    if (pr.totalAmount > 0) {
      result[cat] = {
        expectedReturn: pr.expectedReturn,
        standardDeviation: Math.max(0.001, pr.risk),
      };
      hasAny = true;
    }
  }

  return hasAny ? result : undefined;
}

/** 初期残高比率からリバランス設定を導出 */
export function deriveRebalanceConfig(
  balances: Record<TaxCategory, number>,
  rebalanceEnabled?: boolean,
): { enabled: boolean; targetWeights: Record<TaxCategory, number>; threshold: number } {
  const total = Object.values(balances).reduce((s, v) => s + v, 0);
  if (total <= 0) {
    return {
      enabled: false,
      targetWeights: { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0 },
      threshold: 0.05,
    };
  }
  return {
    enabled: rebalanceEnabled === true,
    targetWeights: {
      nisa: balances.nisa / total,
      tokutei: balances.tokutei / total,
      ideco: balances.ideco / total,
      gold_physical: balances.gold_physical / total,
      cash: balances.cash / total,
    },
    threshold: 0.05,
  };
}

/**
 * 目標アセットアロケーション → 口座レベルウェイトに変換
 *
 * 各資産クラスの口座内訳（現在のportfolioの保有比率）を使い、
 * 目標ウェイトを口座レベルに分配する。
 */
export function deriveTargetAccountWeights(
  targetAllocation: TargetAllocation[],
  portfolio: PortfolioEntry[],
): Record<TaxCategory, number> {
  const result: Record<TaxCategory, number> = { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0 };

  // 資産クラスごとの口座内訳比率を集計
  for (const target of targetAllocation) {
    if (target.weight <= 0) continue;
    const ac = target.assetClass;

    // この資産クラスの保有を口座別に集計
    const byAccount: Record<TaxCategory, number> = { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0 };
    for (const entry of portfolio) {
      if (entry.assetClass === ac && entry.amount > 0) {
        byAccount[entry.taxCategory] += entry.amount;
      }
    }
    const acTotal = Object.values(byAccount).reduce((s, v) => s + v, 0);

    if (acTotal > 0) {
      // 保有比率ベースで口座に分配
      for (const cat of Object.keys(byAccount) as TaxCategory[]) {
        result[cat] += target.weight * (byAccount[cat] / acTotal);
      }
    } else {
      // 保有なし → デフォルト口座マッピング
      if (ac === "gold") {
        result.gold_physical += target.weight;
      } else if (ac === "cash") {
        result.cash += target.weight;
      } else {
        // 保有最大口座 or nisa にフォールバック
        const balances = Object.entries(result)
          .filter(([k]) => k !== "gold_physical" && k !== "cash")
          .sort((a, b) => b[1] - a[1]);
        const fallback = (balances[0]?.[1] ?? 0) > 0
          ? balances[0][0] as TaxCategory
          : "nisa";
        result[fallback] += target.weight;
      }
    }
  }

  // 正規化（合計=1.0を保証）
  const sum = Object.values(result).reduce((s, v) => s + v, 0);
  if (sum > 0 && Math.abs(sum - 1.0) > 0.001) {
    for (const k of Object.keys(result) as TaxCategory[]) {
      result[k] /= sum;
    }
  }

  return result;
}

/**
 * 目標アセットアロケーションから合成リターン・リスクを計算
 */
function calcTargetAllocation(
  targetAllocation: TargetAllocation[],
): { expectedReturn: number; standardDeviation: number } {
  const assets: AssetClassId[] = [];
  const weights: number[] = [];
  for (const t of targetAllocation) {
    if (t.weight > 0 && t.assetClass !== "cash") {
      assets.push(t.assetClass);
      weights.push(t.weight);
    }
  }
  if (assets.length === 0) return { expectedReturn: 0.05, standardDeviation: 0.15 };
  // ウェイトを正規化（cash除外分やtotal≠1.0に対応）
  const wSum = weights.reduce((s, v) => s + v, 0);
  const normWeights = wSum > 0 && Math.abs(wSum - 1.0) > 0.001
    ? weights.map((w) => w / wSum)
    : weights;
  const { expectedReturn, risk } = calcFromWeights(assets, normWeights);
  return { expectedReturn, standardDeviation: Math.max(0.001, risk) };
}

/**
 * 目標アロケーション + 現在保有から口座別のリターン・リスクを導出
 */
function deriveTargetAccountAllocations(
  targetAllocation: TargetAllocation[],
  portfolio: PortfolioEntry[],
  accountWeights: Record<TaxCategory, number>,
): Partial<Record<TaxCategory, AssetAllocation>> | undefined {
  const categories: TaxCategory[] = ["nisa", "tokutei", "ideco", "gold_physical", "cash"];
  const result: Partial<Record<TaxCategory, AssetAllocation>> = {};
  let hasAny = false;

  for (const cat of categories) {
    if (cat === "cash") {
      result.cash = { expectedReturn: 0, standardDeviation: 0 };
      continue;
    }
    if ((accountWeights[cat] ?? 0) <= 0) continue;

    // この口座に割り当てられる資産クラスとウェイトを計算
    const acAssets: AssetClassId[] = [];
    const acWeights: number[] = [];
    for (const target of targetAllocation) {
      if (target.weight <= 0 || target.assetClass === "cash") continue;
      // この資産クラスが当該口座に配分される比率
      const byAccount: Record<TaxCategory, number> = { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0 };
      for (const entry of portfolio) {
        if (entry.assetClass === target.assetClass && entry.amount > 0) {
          byAccount[entry.taxCategory] += entry.amount;
        }
      }
      const acTotal = Object.values(byAccount).reduce((s, v) => s + v, 0);
      let ratio = 0;
      if (acTotal > 0) {
        ratio = byAccount[cat] / acTotal;
      } else {
        // 保有なし → deriveTargetAccountWeightsと同じデフォルト口座マッピング
        if (target.assetClass === "gold" && cat === "gold_physical") {
          ratio = 1;
        } else if (target.assetClass !== "gold") {
          // 保有最大口座を accountWeights から判定
          const investableWeights = Object.entries(accountWeights)
            .filter(([k]) => k !== "gold_physical" && k !== "cash");
          const maxCat = investableWeights.length > 0
            ? investableWeights.sort((a, b) => b[1] - a[1])[0][0]
            : "nisa";
          if (cat === maxCat) ratio = 1;
        }
      }
      if (ratio > 0) {
        acAssets.push(target.assetClass);
        acWeights.push(target.weight * ratio);
      }
    }

    if (acAssets.length > 0) {
      // ウェイトを正規化（口座内の相対配分）
      const wSum = acWeights.reduce((s, v) => s + v, 0);
      const normWeights = acWeights.map((w) => w / wSum);
      const { expectedReturn, risk } = calcFromWeights(acAssets, normWeights);
      result[cat] = {
        expectedReturn,
        standardDeviation: Math.max(0.001, risk),
      };
      hasAny = true;
    }
  }

  return hasAny ? result : undefined;
}

export function formToSimulationInput(form: FormState): SimulationInput {
  // 残高を課税種別から自動集計
  const balances = deriveBalancesByTaxCategory(form.portfolio);

  // 目標アロケーションが有効かどうか判定
  const hasTarget = form.rebalanceEnabled === true
    && form.targetAllocation
    && form.targetAllocation.length > 0
    && form.targetAllocation.some((t) => t.weight > 0);

  let expectedReturn: number;
  let standardDeviation: number;
  let accountAllocations: Partial<Record<TaxCategory, AssetAllocation>> | undefined;
  let rebalance: { enabled: boolean; targetWeights: Record<TaxCategory, number>; threshold: number };

  if (hasTarget) {
    // 目標アロケーションベース
    const target = form.targetAllocation!;
    const alloc = calcTargetAllocation(target);
    expectedReturn = alloc.expectedReturn;
    standardDeviation = alloc.standardDeviation;

    const accountWeights = deriveTargetAccountWeights(target, form.portfolio);
    accountAllocations = deriveTargetAccountAllocations(target, form.portfolio, accountWeights);
    rebalance = { enabled: true, targetWeights: accountWeights, threshold: 0.05 };
  } else {
    // 従来: portfolio起点
    const portfolioResult = calcPortfolio(form.portfolio);
    expectedReturn = portfolioResult.totalAmount > 0
      ? portfolioResult.expectedReturn
      : 0.05;
    standardDeviation = portfolioResult.totalAmount > 0
      ? Math.max(0.001, portfolioResult.risk)
      : 0.15;

    accountAllocations = deriveAccountAllocations(form.portfolio);
    rebalance = deriveRebalanceConfig(balances, form.rebalanceEnabled);
  }

  const currentAge = safeNum(form.currentAge, 35, 18);
  const retirementAge = Math.min(Math.max(safeNum(form.retirementAge, 50, 19), currentAge + 1), 120);
  const endAge = Math.min(Math.max(safeNum(form.endAge, 95, 60), retirementAge + 1), 120);

  return {
    currentAge,
    retirementAge,
    endAge,
    annualSalary: safeNum(form.annualSalary),
    annualExpense: safeNum(form.monthlyExpense) * 12,
    accounts: {
      nisa: balances.nisa,
      tokutei: balances.tokutei,
      ideco: balances.ideco,
      gold_physical: balances.gold_physical,
      cash: balances.cash,
    },
    allocation: {
      expectedReturn,
      standardDeviation,
    },
    idecoYearsOfService: safeNum(form.idecoYearsOfService, 20, 1),
    tokuteiGainRatio: safeNum(form.tokuteiGainRatio, 50) / 100,
    goldGainRatio: safeNum(form.goldGainRatio, 30) / 100,
    inflationRate: safeNum(form.inflationRate, 2.0) / 100,
    withdrawalOrder: (form.withdrawalOrder && Array.isArray(form.withdrawalOrder)
      && form.withdrawalOrder.every((c: TaxCategory) => VALID_TAX_CATEGORIES.includes(c))
      && new Set(form.withdrawalOrder).size === form.withdrawalOrder.length)
      ? form.withdrawalOrder
      : ["cash", "nisa", "tokutei", "gold_physical", "ideco"],
    numTrials: Math.min(safeNum(form.numTrials, 1000, 10), 10_000),
    seed: Math.floor(Math.random() * 2 ** 32),

    // v4.2/v4.3: 口座別アロケーション + リバランス設定
    accountAllocations,
    rebalance,

    // v0.9 拡張 (safeNum で負値・NaN 防御)
    pension: form.pension ? {
      kosei: safeNum(form.pension.kosei, 0),
      kokumin: safeNum(form.pension.kokumin, 0),
      startAge: Math.min(Math.max(safeNum(form.pension.startAge, 65, 60), 60), 75),
    } : undefined,
    retirementBonus: form.retirementBonus ? {
      amount: safeNum(form.retirementBonus.amount, 0),
      yearsOfService: safeNum(form.retirementBonus.yearsOfService, 20, 1),
    } : undefined,
    sideIncome: form.sideIncome ? {
      annualAmount: safeNum(form.sideIncome.annualAmount, 0),
      untilAge: Math.min(safeNum(form.sideIncome.untilAge, 70, currentAge), 120),
    } : undefined,
    lifeEvents: form.lifeEvents?.map((e) => ({
      ...e,
      age: Math.min(safeNum(e.age, currentAge, currentAge), endAge),
      amount: safeNum(e.amount, 0),
    })),
    nisaConfig: form.nisaConfig ? {
      annualLimit: safeNum(form.nisaConfig.annualLimit, 3_600_000),
      lifetimeLimit: safeNum(form.nisaConfig.lifetimeLimit, 18_000_000),
    } : undefined,

    // v1.0 世帯シミュレーション
    spouse: (form.spouse && form.spouseEnabled !== false) ? spouseFormToInput(form.spouse) : undefined,
  };
}

function spouseFormToInput(sp: SpouseFormState): SpouseInput {
  const portfolioResult = calcPortfolio(sp.portfolio);
  const expectedReturn = portfolioResult.totalAmount > 0 ? portfolioResult.expectedReturn : 0.05;
  const standardDeviation = portfolioResult.totalAmount > 0 ? Math.max(0.001, portfolioResult.risk) : 0.15;
  const balances = deriveBalancesByTaxCategory(sp.portfolio);

  const currentAge = safeNum(sp.currentAge, 35, 18);
  const retirementAge = Math.min(Math.max(safeNum(sp.retirementAge, 55, 19), currentAge + 1), 120);

  return {
    currentAge,
    retirementAge,
    annualSalary: safeNum(sp.annualSalary),
    accounts: {
      nisa: balances.nisa,
      tokutei: balances.tokutei,
      ideco: balances.ideco,
      gold_physical: balances.gold_physical,
      cash: balances.cash,
    },
    allocation: { expectedReturn, standardDeviation },
    idecoYearsOfService: safeNum(sp.idecoYearsOfService, 20, 1),
    tokuteiGainRatio: safeNum(sp.tokuteiGainRatio, 50) / 100,
    goldGainRatio: safeNum(sp.goldGainRatio, 30) / 100,
    pension: sp.pension ? {
      kosei: safeNum(sp.pension.kosei, 0),
      kokumin: safeNum(sp.pension.kokumin, 0),
      startAge: Math.min(Math.max(safeNum(sp.pension.startAge, 65, 60), 60), 75),
    } : undefined,
    retirementBonus: sp.retirementBonus ? {
      amount: safeNum(sp.retirementBonus.amount, 0),
      yearsOfService: safeNum(sp.retirementBonus.yearsOfService, 20, 1),
    } : undefined,
    sideIncome: sp.sideIncome ? {
      annualAmount: safeNum(sp.sideIncome.annualAmount, 0),
      untilAge: Math.min(safeNum(sp.sideIncome.untilAge, 70, currentAge), 120),
    } : undefined,
    nisaConfig: sp.nisaConfig ? {
      annualLimit: safeNum(sp.nisaConfig.annualLimit, 3_600_000),
      lifetimeLimit: safeNum(sp.nisaConfig.lifetimeLimit, 18_000_000),
    } : undefined,
  };
}
