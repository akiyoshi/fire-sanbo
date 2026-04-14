import type { AssetClassId, AssetClassData } from "./types";
import { ASSET_CLASS_IDS } from "./types";
import rawData from "@/config/asset-class-data.json";

const assetClasses = rawData.assetClasses as Record<AssetClassId, AssetClassData>;
const correlationOrder = rawData.correlationMatrix.order as AssetClassId[];
const correlationMatrix = rawData.correlationMatrix.matrix as number[][];

function getCorrelation(a: AssetClassId, b: AssetClassId): number {
  const i = correlationOrder.indexOf(a);
  const j = correlationOrder.indexOf(b);
  if (i === -1 || j === -1) return a === b ? 1 : 0;
  return correlationMatrix[i][j];
}

/** 指定ウェイトでリターン・リスクを計算 */
function calcFromWeights(
  assets: AssetClassId[],
  weights: number[],
): { expectedReturn: number; risk: number } {
  let ret = 0;
  for (let i = 0; i < assets.length; i++) {
    ret += weights[i] * assetClasses[assets[i]].expectedReturn;
  }

  let variance = 0;
  for (let i = 0; i < assets.length; i++) {
    for (let j = 0; j < assets.length; j++) {
      const si = assetClasses[assets[i]].risk;
      const sj = assetClasses[assets[j]].risk;
      const rho = getCorrelation(assets[i], assets[j]);
      variance += weights[i] * weights[j] * si * sj * rho;
    }
  }

  return { expectedReturn: ret, risk: Math.sqrt(Math.max(0, variance)) };
}

/** ランダムなウェイト配列を生成（合計=1, 各≥0） */
function randomWeights(n: number, rng: () => number): number[] {
  const raw = Array.from({ length: n }, () => -Math.log(1 - rng())); // ディリクレ分布
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => v / sum);
}

/** 簡易な線形合同法による再現可能な乱数 */
function createRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export interface EfficientFrontierPoint {
  weights: Record<AssetClassId, number>;
  expectedReturn: number;
  risk: number;
}

export interface OptimizationResult {
  /** 効率的フロンティア上の点（リスク昇順） */
  frontier: EfficientFrontierPoint[];
  /** リスク許容度に最も近いフロンティア上のポートフォリオ */
  recommended: EfficientFrontierPoint;
  /** 最小リスクポートフォリオ */
  minRisk: EfficientFrontierPoint;
  /** 最大リターンポートフォリオ */
  maxReturn: EfficientFrontierPoint;
}

/**
 * モンテカルロ法で効率的フロンティアを近似し、
 * 指定リスク許容度に対する最適ポートフォリオを返す
 *
 * @param availableAssets 投資対象の資産クラスID
 * @param riskTolerance リスク許容度 (0-1): 0=最小リスク, 1=最大リターン
 * @param numSamples 生成するランダムポートフォリオ数
 * @param seed 乱数シード
 */
export function optimizePortfolio(
  availableAssets: AssetClassId[],
  riskTolerance: number,
  numSamples = 10000,
  seed = 42,
): OptimizationResult {
  const assets = availableAssets.filter((id) => id !== "cash" && id in assetClasses);
  if (assets.length === 0) {
    const emptyWeights = Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, 0])) as Record<AssetClassId, number>;
    const empty: EfficientFrontierPoint = { weights: emptyWeights, expectedReturn: 0, risk: 0 };
    return { frontier: [empty], recommended: empty, minRisk: empty, maxReturn: empty };
  }

  const rng = createRng(seed);

  // ランダムポートフォリオを大量に生成
  const portfolios: { weights: number[]; ret: number; risk: number }[] = [];
  for (let i = 0; i < numSamples; i++) {
    const w = randomWeights(assets.length, rng);
    const { expectedReturn: ret, risk } = calcFromWeights(assets, w);
    portfolios.push({ weights: w, ret, risk });
  }

  // 100%単一資産のポートフォリオも追加（端を確保）
  for (let i = 0; i < assets.length; i++) {
    const w = assets.map((_, j) => (j === i ? 1 : 0));
    const { expectedReturn: ret, risk } = calcFromWeights(assets, w);
    portfolios.push({ weights: w, ret, risk });
  }

  // リスクでソートしてフロンティアを抽出
  portfolios.sort((a, b) => a.risk - b.risk);

  // 効率的フロンティア: 左からリターンが最大のものだけ残す
  const frontier: typeof portfolios = [];
  let maxRetSoFar = -Infinity;
  // リスク範囲を20分割してビンごとの最大リターンを取得
  const minRisk = portfolios[0].risk;
  const maxRisk = portfolios[portfolios.length - 1].risk;
  const numBins = 30;
  const binWidth = (maxRisk - minRisk) / numBins || 1;

  for (let bin = 0; bin <= numBins; bin++) {
    const lo = minRisk + bin * binWidth;
    const hi = lo + binWidth;
    let best: (typeof portfolios)[0] | null = null;
    for (const p of portfolios) {
      if (p.risk >= lo && p.risk < hi) {
        if (!best || p.ret > best.ret) best = p;
      }
    }
    if (best && best.ret > maxRetSoFar) {
      frontier.push(best);
      maxRetSoFar = best.ret;
    }
  }

  // 最後のビンを確保
  if (frontier.length === 0) {
    frontier.push(portfolios[0]);
  }

  // ウェイトを AssetClassId 形式に変換
  function toWeightRecord(w: number[]): Record<AssetClassId, number> {
    const record = Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, 0])) as Record<AssetClassId, number>;
    for (let i = 0; i < assets.length; i++) {
      record[assets[i]] = w[i];
    }
    return record;
  }

  const frontierPoints: EfficientFrontierPoint[] = frontier.map((p) => ({
    weights: toWeightRecord(p.weights),
    expectedReturn: p.ret,
    risk: p.risk,
  }));

  return {
    frontier: frontierPoints,
    recommended: selectRecommended(frontierPoints, riskTolerance),
    minRisk: frontierPoints[0],
    maxReturn: frontierPoints[frontierPoints.length - 1],
  };
}

/** フロンティア上からリスク許容度に最も近いポートフォリオを選択 */
export function selectRecommended(
  frontier: EfficientFrontierPoint[],
  riskTolerance: number,
): EfficientFrontierPoint {
  if (frontier.length === 0) {
    const emptyWeights = Object.fromEntries(ASSET_CLASS_IDS.map((id) => [id, 0])) as Record<AssetClassId, number>;
    return { weights: emptyWeights, expectedReturn: 0, risk: 0 };
  }
  const frontierMinRisk = frontier[0].risk;
  const frontierMaxRisk = frontier[frontier.length - 1].risk;
  const targetRisk = frontierMinRisk + riskTolerance * (frontierMaxRisk - frontierMinRisk);

  let recommended = frontier[0];
  let minDist = Infinity;
  for (const p of frontier) {
    const dist = Math.abs(p.risk - targetRisk);
    if (dist < minDist) {
      minDist = dist;
      recommended = p;
    }
  }
  return recommended;
}
