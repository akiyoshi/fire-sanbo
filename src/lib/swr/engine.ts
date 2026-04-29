import { runSimulationLite } from "@/lib/prescription/engine";
import type { SimulationInput } from "@/lib/simulation";

/**
 * SWR 自動算定の結果。
 *
 * v4.6.2 (C-3): 改善計画書 §5.2 に準拠。
 *
 * - `maxAnnualExpense` — 目標成功率を満たす最大の年間支出（円）
 * - `monthlyExpense` — 月額換算（UI 表示の primary 数値、autoplan AD-12）
 * - `rate` — 退職時総資産に対する取り崩し率 (0〜1)。`maxAnnualExpense / 退職時総資産` ではなく、
 *           現状資産に対する「年間支出 / 全資産」を採る簡易定義（`Bengen 4%` と直接比較するため）
 * - `vsBengen4Pct` — Bengen 4% (0.04) との差分（負ならより保守的）
 * - `targetRate` — 算定に使った目標成功率 (0〜1)
 * - `convergenceIterations` — 二分探索の反復回数（デバッグ／性能監視）
 */
export interface SWRResult {
  maxAnnualExpense: number;
  monthlyExpense: number;
  rate: number;
  vsBengen4Pct: number;
  targetRate: number;
  convergenceIterations: number;
}

const DEFAULT_TARGET_RATE = 0.90;
const MAX_ITERATIONS = 25;
/** 月額単位 (5,000円刻み) で停止 */
const PRECISION_YEN = 5_000 * 12;

/**
 * 入力ポートフォリオ・期間から、目標成功率を満たす最大の年間支出を算定する。
 *
 * 設計判断:
 * - SWR は本質的に「処方箋エンジンの expense 軸の探索結果そのもの」だが、
 *   prescription の AXIS_CONFIGS は「現在支出より少ない値のみ探索」するため、
 *   資産に余裕があるユーザー（成功率 100%）の真の SWR を求められない。
 * - そこで自前で二分探索し、上限を「現在支出 × 3」または年間 1,200 万円のうち大きい方に拡張する。
 * - 内部の試行は `runSimulationLite` への委譲（autoplan AD-2 — DRY）。
 *
 * @param input - シミュレーション入力（一時的に `annualExpense` を変動させる）
 * @param targetRate - 目標成功率 (0〜1)。既定 0.90
 * @returns SWR 結果
 */
export function calcSWR(
  input: SimulationInput,
  targetRate: number = DEFAULT_TARGET_RATE,
): SWRResult {
  // 全口座の合計（退職時資産の代理値）
  const totalAssets =
    input.accounts.nisa +
    input.accounts.tokutei +
    input.accounts.ideco +
    input.accounts.gold_physical +
    input.accounts.cash;

  // 探索範囲: 月5万 〜 「現在支出 × 3 か 月100万 か どちらか大きい方」
  const minAnnual = 5_000 * 12;
  const maxAnnual = Math.max(input.annualExpense * 3, 1_000_000 * 12);

  let lo = minAnnual;
  let hi = maxAnnual;
  let iterations = 0;

  // 上限でも目標達成（資産が膨大）→ そのまま maxAnnual を返す
  const upperRate = runSimulationLite({ ...input, annualExpense: maxAnnual });
  if (upperRate >= targetRate) {
    return buildResult(maxAnnual, targetRate, totalAssets, 1);
  }

  // 下限でも目標未達（資産が少ない）→ minAnnual を返す（SWR < 月5万）
  const lowerRate = runSimulationLite({ ...input, annualExpense: minAnnual });
  if (lowerRate < targetRate) {
    return buildResult(minAnnual, targetRate, totalAssets, 1);
  }

  // 標準二分探索: 「成功する最大値」を求める
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    iterations = i + 1;
    if (hi - lo <= PRECISION_YEN) break;
    const mid = Math.floor((lo + hi) / 2);
    const rate = runSimulationLite({ ...input, annualExpense: mid });
    if (rate >= targetRate) {
      lo = mid; // 達成 → もっと大きく試す
    } else {
      hi = mid; // 未達 → 小さく
    }
  }

  return buildResult(lo, targetRate, totalAssets, iterations);
}

function buildResult(
  maxAnnualExpense: number,
  targetRate: number,
  totalAssets: number,
  iterations: number,
): SWRResult {
  const rate = totalAssets > 0 ? maxAnnualExpense / totalAssets : 0;
  return {
    maxAnnualExpense,
    monthlyExpense: Math.round(maxAnnualExpense / 12),
    rate,
    vsBengen4Pct: rate - 0.04,
    targetRate,
    convergenceIterations: iterations,
  };
}
