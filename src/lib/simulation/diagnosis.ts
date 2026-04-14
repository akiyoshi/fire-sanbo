import type { TrialResult, YearResult, SimulationResult } from "./types";

/** 失敗原因の分類 */
export type FailureCause =
  | "crash"           // 退職後5年以内に−20%超の暴落
  | "underfunded"     // 暴落なしでも資産減少（資金不足）
  | "life_event"      // 特定年の支出が通常の2倍以上
  | "longevity"       // 80歳以降に枯渇（前半は順調）
  | "none";           // 成功試行

export interface TurningPoint {
  age: number;
  portfolioReturn: number;
  totalAssets: number;
  medianAssets: number;
}

export interface Diagnosis {
  cause: FailureCause;
  causeLabel: string;
  summary: string;
  /** 転換点（暴落型: 暴落年、資金不足型: 枯渇年、等） */
  turningPoint: TurningPoint | null;
  /** p5に最も近い試行 */
  worstTrial: TrialResult;
  /** 退職年齢 */
  retirementAge: number;
}

const CRASH_THRESHOLD = -0.20;
const CRASH_WINDOW_YEARS = 5;
const EXPENSE_SPIKE_RATIO = 2.0;
const LONGEVITY_AGE = 80;

/**
 * p5に最も近い失敗試行を取得する。
 * 失敗試行がない場合は最も資産が少ない試行を返す。
 */
export function findP5Trial(result: SimulationResult): TrialResult {
  const sorted = [...result.trials].sort((a, b) => a.finalAssets - b.finalAssets);
  const p5Index = Math.max(0, Math.floor(sorted.length * 0.05) - 1);
  return sorted[p5Index];
}

/**
 * 失敗試行を診断し、失敗原因を分類する
 */
export function diagnoseFailure(
  trial: TrialResult,
  retirementAge: number,
  medianAssets: number[],
): Diagnosis {
  const base = { worstTrial: trial, retirementAge };

  // 成功試行
  if (trial.success) {
    return {
      ...base,
      cause: "none",
      causeLabel: "成功",
      summary: `このシナリオでは${trial.years[trial.years.length - 1]?.age ?? "?"}歳まで資産が持続しました。`,
      turningPoint: null,
    };
  }

  const years = trial.years;
  const retIdx = years.findIndex((y) => y.age === retirementAge);
  const retiredYears = retIdx >= 0 ? years.slice(retIdx) : years;

  // 1. 暴落型: 退職後5年以内に−20%超のリターン
  const crashYear = findCrashYear(retiredYears, CRASH_WINDOW_YEARS);
  if (crashYear) {
    const yearsSinceRetirement = crashYear.age - retirementAge;
    const medianAtAge = medianAssets[years.findIndex((y) => y.age === crashYear.age)] ?? 0;
    return {
      ...base,
      cause: "crash",
      causeLabel: "暴落型",
      summary: `${crashYear.age}歳（退職${yearsSinceRetirement === 0 ? "直後" : `${yearsSinceRetirement}年目`}）にポートフォリオが${formatReturn(crashYear.portfolioReturn)}下落。${
        trial.depletionAge ? `${trial.depletionAge}歳で資産枯渇。` : ""
      }中央値シナリオでは同年の資産は${formatManYen(medianAtAge)}。`,
      turningPoint: {
        age: crashYear.age,
        portfolioReturn: crashYear.portfolioReturn,
        totalAssets: crashYear.totalAssets,
        medianAssets: medianAtAge,
      },
    };
  }

  // 2. ライフイベント集中型: 通常支出の2倍以上の年がある
  const normalExpense = retiredYears.length > 0
    ? median(retiredYears.map((y) => y.expense))
    : 0;
  const spikeYear = retiredYears.find(
    (y) => normalExpense > 0 && y.expense >= normalExpense * EXPENSE_SPIKE_RATIO,
  );
  if (spikeYear) {
    const medianAtAge = medianAssets[years.findIndex((y) => y.age === spikeYear.age)] ?? 0;
    return {
      ...base,
      cause: "life_event",
      causeLabel: "ライフイベント集中型",
      summary: `${spikeYear.age}歳に支出が${formatManYen(spikeYear.expense)}に急増（通常${formatManYen(normalExpense)}）。${
        trial.depletionAge ? `${trial.depletionAge}歳で資産枯渇。` : ""
      }`,
      turningPoint: {
        age: spikeYear.age,
        portfolioReturn: spikeYear.portfolioReturn,
        totalAssets: spikeYear.totalAssets,
        medianAssets: medianAtAge,
      },
    };
  }

  // 3. 長寿リスク型: 80歳以降に枯渇
  if (trial.depletionAge && trial.depletionAge >= LONGEVITY_AGE) {
    const depletionIdx = years.findIndex((y) => y.age === trial.depletionAge);
    const medianAtAge = depletionIdx >= 0 ? (medianAssets[depletionIdx] ?? 0) : 0;
    return {
      ...base,
      cause: "longevity",
      causeLabel: "長寿リスク型",
      summary: `前半は順調でしたが、${trial.depletionAge}歳で資産枯渇。長期の取り崩しにより徐々に資産が減少しました。`,
      turningPoint: trial.depletionAge
        ? {
            age: trial.depletionAge,
            portfolioReturn: years[depletionIdx]?.portfolioReturn ?? 0,
            totalAssets: 0,
            medianAssets: medianAtAge,
          }
        : null,
    };
  }

  // 4. 資金不足型（デフォルト）
  const depletionIdx = years.findIndex((y) => y.age === trial.depletionAge);
  const medianAtDepletion = depletionIdx >= 0 ? (medianAssets[depletionIdx] ?? 0) : 0;
  return {
    ...base,
    cause: "underfunded",
    causeLabel: "資金不足型",
    summary: `退職時の資産が十分でなく、${trial.depletionAge ? `${trial.depletionAge}歳` : "早期"}で資産枯渇。暴落がなくても資産が減り続けるパターンです。`,
    turningPoint: trial.depletionAge
      ? {
          age: trial.depletionAge,
          portfolioReturn: years[depletionIdx]?.portfolioReturn ?? 0,
          totalAssets: 0,
          medianAssets: medianAtDepletion,
        }
      : null,
  };
}

/** 退職後N年以内に閾値以下の暴落年を探す */
function findCrashYear(
  retiredYears: YearResult[],
  windowYears: number,
): YearResult | null {
  const window = retiredYears.slice(0, windowYears + 1);
  let worst: YearResult | null = null;
  for (const y of window) {
    if (y.portfolioReturn <= CRASH_THRESHOLD) {
      if (!worst || y.portfolioReturn < worst.portfolioReturn) {
        worst = y;
      }
    }
  }
  return worst;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function formatReturn(r: number): string {
  return `${(r * 100).toFixed(0)}%`;
}

import { formatManYen as _formatManYen } from "@/lib/utils";

function formatManYen(n: number): string {
  return _formatManYen(n, true);
}
