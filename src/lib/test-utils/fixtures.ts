/**
 * テスト用 fixture ファクトリ。
 *
 * 各テストファイルで個別に定義されていた `makeAccts` / `makeAccounts` /
 * `makeYear` / `baseInput` を集約し、命名と既定値を統一する。
 *
 * 命名規約: テストデータ生成は `create*()` で統一する。
 * 部分上書きが必要な場合は `Partial<T>` の overrides を受け取る。
 */

import { CostBasis } from "@/lib/simulation/cost-basis";
import type { MemberAccounts } from "@/lib/simulation/helpers";
import type {
  SimulationInput,
  SpouseInput,
  TrialResult,
  YearResult,
} from "@/lib/simulation/types";

/**
 * 世帯口座 (`MemberAccounts`) のテスト用ファクトリ。
 *
 * - 残高は全口座 0 円（必要な口座だけ overrides で指定）。
 * - `tokuteiCB` / `goldCB` は overrides の残高に追従して初期化される。
 * - `nisaCumulative` は overrides の `nisa` をデフォルト累計として扱う。
 */
export function createMemberAccounts(
  overrides: Partial<MemberAccounts> = {},
): MemberAccounts {
  const nisa = overrides.nisa ?? 0;
  const tokutei = overrides.tokutei ?? 0;
  const gold = overrides.gold ?? 0;
  return {
    nisa,
    tokutei,
    ideco: overrides.ideco ?? 0,
    gold,
    cash: overrides.cash ?? 0,
    nisaCumulative: overrides.nisaCumulative ?? nisa,
    tokuteiCB: overrides.tokuteiCB ?? new CostBasis(tokutei, 0.5),
    goldCB: overrides.goldCB ?? new CostBasis(gold, 0.3),
  };
}

/**
 * `SimulationInput` のテスト用ファクトリ。
 *
 * 「働き世代の個人 FIRE」を想定した中庸な既定値。値の意味は以下の通り:
 * - 35→50 歳で退職、95 歳まで観測
 * - 給与 600 万 / 支出 360 万
 * - NISA300 万 + 特定 500 万 + iDeCo200 万
 * - 期待リターン 5% / σ 15% / インフレ 2%
 * - numTrials 100 / seed 42（再現性確保）
 *
 * 値は意図的に prescription/withdrawal/engine の各テストで共有されている
 * 「典型的なケース」に揃えてある。個別シナリオは `overrides` で上書きする。
 */
export function createSimulationInput(
  overrides: Partial<SimulationInput> = {},
): SimulationInput {
  return {
    currentAge: 35,
    retirementAge: 50,
    endAge: 95,
    annualSalary: 6_000_000,
    annualExpense: 3_600_000,
    accounts: {
      nisa: 3_000_000,
      tokutei: 5_000_000,
      ideco: 2_000_000,
      gold_physical: 0,
      cash: 0,
    },
    allocation: { expectedReturn: 0.05, standardDeviation: 0.15 },
    idecoYearsOfService: 20,
    tokuteiGainRatio: 0.5,
    goldGainRatio: 0.3,
    withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
    numTrials: 100,
    inflationRate: 0.02,
    seed: 42,
    ...overrides,
  };
}

/**
 * `SpouseInput` のテスト用ファクトリ。
 *
 * 既定は配偶者 33 歳・退職 50 歳・給与 400 万・口座は最小（NISA100 万のみ）。
 */
export function createSpouseInput(
  overrides: Partial<SpouseInput> = {},
): SpouseInput {
  return {
    currentAge: 33,
    retirementAge: 50,
    annualSalary: 4_000_000,
    accounts: {
      nisa: 1_000_000,
      tokutei: 0,
      ideco: 0,
      gold_physical: 0,
      cash: 0,
    },
    allocation: { expectedReturn: 0.05, standardDeviation: 0.15 },
    idecoYearsOfService: 15,
    tokuteiGainRatio: 0.5,
    goldGainRatio: 0.3,
    ...overrides,
  };
}

/**
 * `YearResult` のテスト用ファクトリ。
 *
 * 必須は `age` のみ。ほかは「資産 1,000 万、支出 300 万、税ゼロ、リターン 5%」。
 */
export function createYearResult(
  overrides: Partial<YearResult> & { age: number },
): YearResult {
  return {
    totalAssets: 10_000_000,
    nisa: 0,
    tokutei: 0,
    ideco: 0,
    gold_physical: 0,
    cash: 0,
    income: 0,
    expense: 3_000_000,
    taxBreakdown: {
      incomeTax: 0,
      residentTax: 0,
      socialInsurance: 0,
      withdrawalTax: 0,
      total: 0,
    },
    withdrawal: 3_000_000,
    portfolioReturn: 0.05,
    ...overrides,
  };
}

/**
 * `TrialResult` のテスト用ファクトリ。
 *
 * `years` 配列の最後の `totalAssets` を `finalAssets` にする慣習に従う。
 */
export function createTrialResult(
  years: YearResult[],
  success: boolean,
  depletionAge: number | null = null,
): TrialResult {
  return {
    years,
    success,
    depletionAge,
    finalAssets: years[years.length - 1]?.totalAssets ?? 0,
  };
}
