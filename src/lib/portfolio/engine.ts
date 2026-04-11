import type { AssetClassId, AssetClassData, PortfolioEntry, PortfolioResult } from "./types";
import { ASSET_CLASS_IDS } from "./types";
import rawData from "@/config/asset-class-data.json";

const assetClasses = rawData.assetClasses as Record<AssetClassId, AssetClassData>;
const correlationOrder = rawData.correlationMatrix.order as AssetClassId[];
const correlationMatrix = rawData.correlationMatrix.matrix as number[][];

/** 資産クラスのラベル一覧を取得 */
export function getAssetClassLabel(id: AssetClassId): string {
  return assetClasses[id].label;
}

/** 全資産クラスのデータを取得 */
export function getAssetClassData(): Record<AssetClassId, AssetClassData> {
  return assetClasses;
}

/** 相関係数を取得 */
function getCorrelation(a: AssetClassId, b: AssetClassId): number {
  const i = correlationOrder.indexOf(a);
  const j = correlationOrder.indexOf(b);
  if (i === -1 || j === -1) return a === b ? 1 : 0;
  return correlationMatrix[i][j];
}

/**
 * ポートフォリオの合成リターン・リスクを計算する
 *
 * リターン: 加重平均
 * リスク: σ_p = sqrt(Σ_i Σ_j w_i * w_j * σ_i * σ_j * ρ_ij)
 */
export function calcPortfolio(entries: PortfolioEntry[]): PortfolioResult {
  const nonZero = entries.filter((e) => e.amount > 0);
  const totalAmount = nonZero.reduce((s, e) => s + e.amount, 0);

  if (totalAmount === 0) {
    const weights = Object.fromEntries(
      ASSET_CLASS_IDS.map((id) => [id, 0])
    ) as Record<AssetClassId, number>;
    return { expectedReturn: 0, risk: 0, weights, totalAmount: 0 };
  }

  // ウェイト計算
  const weights = Object.fromEntries(
    ASSET_CLASS_IDS.map((id) => [id, 0])
  ) as Record<AssetClassId, number>;
  for (const e of nonZero) {
    weights[e.assetClass] += e.amount / totalAmount;
  }

  // 合成リターン（加重平均）
  let expectedReturn = 0;
  for (const e of nonZero) {
    const w = e.amount / totalAmount;
    expectedReturn += w * assetClasses[e.assetClass].expectedReturn;
  }

  // 合成リスク（相関行列を使ったポートフォリオ標準偏差）
  let variance = 0;
  for (const a of nonZero) {
    for (const b of nonZero) {
      const wi = a.amount / totalAmount;
      const wj = b.amount / totalAmount;
      const si = assetClasses[a.assetClass].risk;
      const sj = assetClasses[b.assetClass].risk;
      const rho = getCorrelation(a.assetClass, b.assetClass);
      variance += wi * wj * si * sj * rho;
    }
  }
  const risk = Math.sqrt(Math.max(0, variance));

  return { expectedReturn, risk, weights, totalAmount };
}
