/**
 * テスト用アサーションヘルパー。
 *
 * 同じ検証ロジックを複数のテストで繰り返さないために、共通の
 * 「意味のあるアサーション」をここに切り出す。
 *
 * 命名規約: 関数は `expect*()` で統一する（vitest の `expect()` と
 * 親和性を保つため）。
 */

import { expect } from "vitest";
import type { SimulationResult } from "@/lib/simulation/types";

/**
 * パーセンタイル系列が p5 ≤ p25 ≤ p50 ≤ p75 ≤ p95 の順に並んでいるか検証する。
 *
 * モンテカルロシミュレーションの結果が統計的に正しいかを保証する不変式。
 * 各 age インデックスごとに 4 件のアサーションを発行する。
 */
export function expectPercentilesOrdered(result: SimulationResult): void {
  for (let i = 0; i < result.ages.length; i++) {
    expect(
      result.percentiles.p5[i],
      `p5 should be ≤ p25 at age=${result.ages[i]}`,
    ).toBeLessThanOrEqual(result.percentiles.p25[i]);
    expect(
      result.percentiles.p25[i],
      `p25 should be ≤ p50 at age=${result.ages[i]}`,
    ).toBeLessThanOrEqual(result.percentiles.p50[i]);
    expect(
      result.percentiles.p50[i],
      `p50 should be ≤ p75 at age=${result.ages[i]}`,
    ).toBeLessThanOrEqual(result.percentiles.p75[i]);
    expect(
      result.percentiles.p75[i],
      `p75 should be ≤ p95 at age=${result.ages[i]}`,
    ).toBeLessThanOrEqual(result.percentiles.p95[i]);
  }
}

/**
 * 値が `[low, high]` の閉区間に含まれているか検証する。
 *
 * モンテカルロ等の確率的テストで「およそこの範囲」を表明するために使う。
 * vitest 標準の `toBeGreaterThan` + `toBeLessThan` を 2 行書く代わりに、
 * 1 行で意図を明示できる。
 *
 * @param value 検証対象
 * @param low 下限（含む）
 * @param high 上限（含む）
 * @param hint 失敗時メッセージのヒント（任意）
 */
export function expectInRange(
  value: number,
  low: number,
  high: number,
  hint?: string,
): void {
  const label = hint ? `${hint}: ` : "";
  expect(
    value,
    `${label}expected ${value} to be ≥ ${low}`,
  ).toBeGreaterThanOrEqual(low);
  expect(
    value,
    `${label}expected ${value} to be ≤ ${high}`,
  ).toBeLessThanOrEqual(high);
}
