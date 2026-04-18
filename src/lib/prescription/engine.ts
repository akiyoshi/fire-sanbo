import type { SimulationInput } from "@/lib/simulation";
import type { PRNG as PRNGType } from "@/lib/simulation";
import type {
  Prescription,
  PrescriptionAxis,
  PrescriptionResult,
  Difficulty,
} from "./types";

/** 効率的フロンティア上の点（portfolio/optimizer.ts からの型再定義、Worker内でのインポート回避） */
export interface FrontierPoint {
  weights: Record<string, number>;
  expectedReturn: number;
  risk: number;
}

// --- runSimulationLite: successRateのみ返す軽量版 ---

import { PRNG, generateLogNormalReturn } from "@/lib/simulation";
import { calcAnnualPension, calcLifeEventExpense, drawFromAccounts, contributeSurplus } from "@/lib/simulation/helpers";
import type { MemberAccounts } from "@/lib/simulation/helpers";
import { CostBasis } from "@/lib/simulation/cost-basis";
import { withdrawFromMember } from "@/lib/simulation/member-withdrawal";
import {
  calcAnnualTax,
  calcSocialInsurancePremium,
  calcPublicPensionDeduction,
  calcComprehensiveTax,
  calcRetirementBonusNet,
} from "@/lib/tax";

function runTrialLite(input: SimulationInput, rng: PRNGType): boolean {
  const accts: MemberAccounts = {
    nisa: input.accounts.nisa,
    tokutei: input.accounts.tokutei,
    ideco: input.accounts.ideco,
    gold: input.accounts.gold_physical,
    cash: input.accounts.cash,
    nisaCumulative: input.accounts.nisa,
    tokuteiCB: new CostBasis(input.accounts.tokutei, input.tokuteiGainRatio),
    goldCB: new CostBasis(input.accounts.gold_physical, input.goldGainRatio),
  };

  for (let age = input.currentAge; age <= input.endAge; age++) {
    // 給与所得
    let income = 0;
    if (age < input.retirementAge) {
      const taxResult = calcAnnualTax(input.annualSalary, age);
      income = taxResult.netIncome;
    }

    // 退職金
    if (input.retirementBonus && age === input.retirementAge && input.retirementBonus.amount > 0) {
      const bonus = calcRetirementBonusNet(input.retirementBonus.amount, input.retirementBonus.yearsOfService);
      accts.tokutei += bonus.net;
      accts.tokuteiCB.contribute(bonus.net);
    }

    // 退職後の収入源（総合課税統合）
    let postRetirementIncome = 0;
    let comprehensiveIncome = 0;
    if (age >= input.retirementAge) {
      const pensionGross = calcAnnualPension(input.pension, age);
      let pensionTaxable = 0;
      if (pensionGross > 0) {
        const deduction = calcPublicPensionDeduction(pensionGross, age);
        pensionTaxable = Math.max(0, pensionGross - deduction);
      }
      const sideIncome = (input.sideIncome && age <= input.sideIncome.untilAge)
        ? input.sideIncome.annualAmount : 0;
      comprehensiveIncome = pensionTaxable + sideIncome;
      const grossIncome = pensionGross + sideIncome;
      if (comprehensiveIncome > 0) {
        const compTax = calcComprehensiveTax(pensionTaxable, sideIncome, 0);
        postRetirementIncome = grossIncome - compTax.total;
      } else {
        postRetirementIncome = grossIncome;
      }
    }

    // ライフイベント
    const lifeEventExpense = calcLifeEventExpense(input.lifeEvents, age);

    // 取り崩しフェーズ（退職後）
    if (age >= input.retirementAge) {
      const retiredSocialInsurance = calcSocialInsurancePremium(0, age);
      const needed = input.annualExpense + retiredSocialInsurance + lifeEventExpense;
      const remaining = Math.max(0, needed - postRetirementIncome);

      if (remaining > 0) {
        const wResult = withdrawFromMember(accts, remaining, input.withdrawalOrder, age, {
          yearsOfService: input.idecoYearsOfService,
          comprehensiveIncome,
        });
        comprehensiveIncome = wResult.comprehensiveIncome;
      }
    }

    // 余剰積立 / 赤字取り崩し（退職前）
    if (age < input.retirementAge) {
      const surplus = income - input.annualExpense - lifeEventExpense;
      if (surplus > 0) {
        contributeSurplus(accts, surplus);
      } else if (surplus < 0) {
        drawFromAccounts(accts, -surplus, input.withdrawalOrder, age);
      }
    }

    // ポートフォリオリターン
    const realReturn = input.allocation.expectedReturn - input.inflationRate;
    const portfolioReturn = generateLogNormalReturn(realReturn, input.allocation.standardDeviation, rng);
    accts.nisa = Math.max(0, accts.nisa * (1 + portfolioReturn));
    accts.tokutei = Math.max(0, accts.tokutei * (1 + portfolioReturn));
    accts.ideco = Math.max(0, accts.ideco * (1 + portfolioReturn));
    accts.gold = Math.max(0, accts.gold * (1 + portfolioReturn));

    if (accts.nisa + accts.tokutei + accts.ideco + accts.gold + accts.cash <= 0 && age >= input.retirementAge) {
      return false;
    }
  }
  return true;
}

/** 軽量シミュレーション: successRateのみ返す（メモリ節約） */
export function runSimulationLite(input: SimulationInput): number {
  const baseSeed = input.seed ?? Math.floor(Math.random() * 2 ** 32);
  let success = 0;
  for (let i = 0; i < input.numTrials; i++) {
    const rng = new PRNG(baseSeed + i);
    if (runTrialLite(input, rng)) success++;
  }
  return success / input.numTrials;
}

// --- 二分探索 ---

const MAX_ITERATIONS = 25;

interface AxisConfig {
  /** 探索下限を返す */
  lo: (input: SimulationInput) => number;
  /** 探索上限を返す */
  hi: (input: SimulationInput) => number;
  /** 精度（停止条件） */
  precision: number;
  /** inputにパラメータを適用して新しいinputを返す */
  apply: (input: SimulationInput, value: number) => SimulationInput;
  /** 成功率が上がる方向はloかhiか。true = 小さい値ほど成功率が高い */
  lowerIsBetter: boolean;
  /** 現在値を取得 */
  current: (input: SimulationInput) => number;
  /** ラベル生成 */
  label: (current: number, target: number) => string;
  /** デルタ文字列生成 */
  delta: (current: number, target: number) => string;
  /** 難易度判定 */
  difficulty: (current: number, target: number) => Difficulty;
}

const AXIS_CONFIGS: Record<"expense" | "retirement" | "income", AxisConfig> = {
  expense: {
    lo: () => 50_000 * 12, // 月5万円（年60万円）
    hi: (input) => input.annualExpense,
    precision: 5_000 * 12, // 月5,000円単位
    apply: (input, value) => ({ ...input, annualExpense: value }),
    lowerIsBetter: true,
    current: (input) => input.annualExpense,
    label: (cur, tgt) => {
      const diff = Math.round((cur - tgt) / 12);
      return `月${diff.toLocaleString()}円の支出削減`;
    },
    delta: (cur, tgt) => {
      const diff = Math.round((tgt - cur) / 12);
      return `${diff.toLocaleString()}円/月`;
    },
    difficulty: (cur, tgt) => {
      const monthlyDiff = (cur - tgt) / 12;
      if (monthlyDiff <= 20_000) return "easy";
      if (monthlyDiff <= 50_000) return "moderate";
      return "hard";
    },
  },
  retirement: {
    lo: (input) => input.retirementAge,
    hi: () => 75,
    precision: 1,
    apply: (input, value) => ({ ...input, retirementAge: value }),
    lowerIsBetter: false,
    current: (input) => input.retirementAge,
    label: (cur, tgt) => {
      const diff = tgt - cur;
      return `退職を${diff}年遅らせる`;
    },
    delta: (cur, tgt) => `+${tgt - cur}年`,
    difficulty: (cur, tgt) => {
      const diff = tgt - cur;
      if (diff <= 1) return "easy";
      if (diff <= 3) return "moderate";
      return "hard";
    },
  },
  income: {
    lo: (input) => input.annualSalary,
    hi: (input) => Math.max(input.annualSalary * 2, 10_000_000),
    precision: 100_000, // 10万円単位
    apply: (input, value) => ({ ...input, annualSalary: value }),
    lowerIsBetter: false,
    current: (input) => input.annualSalary,
    label: (cur, tgt) => {
      const diff = Math.round((tgt - cur) / 10_000);
      return `年収を+${diff.toLocaleString()}万円にする`;
    },
    delta: (cur, tgt) => {
      const diff = Math.round((tgt - cur) / 10_000);
      return `+${diff.toLocaleString()}万円/年`;
    },
    difficulty: (cur, tgt) => {
      const diff = tgt - cur;
      if (diff <= 500_000) return "easy";
      if (diff <= 1_500_000) return "moderate";
      return "hard";
    },
  },
};

function binarySearchAxis(
  axis: "expense" | "retirement" | "income",
  input: SimulationInput,
  targetRate: number,
): Prescription | null {
  const cfg = AXIS_CONFIGS[axis];
  let lo = cfg.lo(input);
  let hi = cfg.hi(input);

  // 探索幅がない場合
  if (lo >= hi) return null;

  // 上限でも目標に届かない場合
  const extremeValue = cfg.lowerIsBetter ? lo : hi;
  const extremeInput = cfg.apply(input, extremeValue);
  const extremeRate = runSimulationLite(extremeInput);
  if (extremeRate < targetRate) return null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (hi - lo <= cfg.precision) break;

    const mid = cfg.lowerIsBetter
      ? Math.floor((lo + hi) / 2)
      : Math.ceil((lo + hi) / 2);

    const midInput = cfg.apply(input, mid);
    const rate = runSimulationLite(midInput);

    if (cfg.lowerIsBetter) {
      // 小さい値ほど良い: 目標達成ならloを上げる（もっと緩くできる）
      if (rate >= targetRate) {
        lo = mid;
      } else {
        hi = mid;
      }
    } else {
      // 大きい値ほど良い: 目標達成ならhiを下げる（もっと小さくできる）
      if (rate >= targetRate) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
  }

  // 最終値を決定
  const targetValue = cfg.lowerIsBetter ? lo : hi;
  const currentValue = cfg.current(input);

  // 変化なし
  if (targetValue === currentValue) return null;

  // 最終確認
  const finalInput = cfg.apply(input, targetValue);
  const finalRate = runSimulationLite(finalInput);

  return {
    axis,
    label: cfg.label(currentValue, targetValue),
    currentValue,
    targetValue,
    delta: cfg.delta(currentValue, targetValue),
    resultRate: finalRate,
    difficulty: cfg.difficulty(currentValue, targetValue),
  };
}

/** フロンティア走査: 目標成功率を満たす最小リスクのフロンティア点を見つける */
function searchFrontierAxis(
  input: SimulationInput,
  targetRate: number,
  frontier: FrontierPoint[],
): Prescription | null {
  if (frontier.length === 0) return null;

  const currentReturn = input.allocation.expectedReturn;
  const currentRisk = input.allocation.standardDeviation;

  // フロンティアはリスク昇順。各点でシミュレーションして目標を満たす最小リスク点を探す
  let bestPoint: FrontierPoint | null = null;
  let bestRate = 0;

  for (const point of frontier) {
    // 現在の配分と同じなら飛ばす
    if (
      Math.abs(point.expectedReturn - currentReturn) < 0.001 &&
      Math.abs(point.risk - currentRisk) < 0.001
    ) {
      continue;
    }

    const testInput: SimulationInput = {
      ...input,
      allocation: {
        expectedReturn: point.expectedReturn,
        standardDeviation: point.risk,
      },
    };
    const rate = runSimulationLite(testInput);

    if (rate >= targetRate) {
      bestPoint = point;
      bestRate = rate;
      break; // リスク昇順なので最初に見つかったものが最小リスク
    }
  }

  if (!bestPoint) return null;

  const riskDiffAbs = Math.abs(bestPoint.risk - currentRisk);
  const difficulty: Difficulty =
    riskDiffAbs <= 0.02 ? "easy" : riskDiffAbs <= 0.05 ? "moderate" : "hard";

  return {
    axis: "allocation",
    label: `リスクを${(currentRisk * 100).toFixed(1)}%→${(bestPoint.risk * 100).toFixed(1)}%に調整`,
    currentValue: currentRisk,
    targetValue: bestPoint.risk,
    delta: `リスク ${(currentRisk * 100).toFixed(1)}% → ${(bestPoint.risk * 100).toFixed(1)}%`,
    resultRate: bestRate,
    difficulty,
    recommendedAllocation: bestPoint.weights,
  };
}

/** 4軸の処方箋を生成 */
export function generatePrescriptions(
  input: SimulationInput,
  targetRate: number,
  seed?: number,
  frontier?: FrontierPoint[],
): PrescriptionResult {
  // seed固定で全軸同一のランダム系列を使う
  const fixedSeed = seed ?? Math.floor(Math.random() * 2 ** 32);
  const seededInput: SimulationInput = {
    ...input,
    seed: fixedSeed,
    numTrials: 500, // 処方箋計算は500試行で速度優先
  };

  const currentRate = runSimulationLite(seededInput);

  if (currentRate >= targetRate) {
    return {
      targetRate,
      currentRate,
      prescriptions: [],
      alreadyAchieved: true,
    };
  }

  const prescriptions: Prescription[] = [];

  // expense軸
  const expenseRx = binarySearchAxis("expense", seededInput, targetRate);
  if (expenseRx) prescriptions.push(expenseRx);

  // retirement軸
  const retirementRx = binarySearchAxis("retirement", seededInput, targetRate);
  if (retirementRx) prescriptions.push(retirementRx);

  // income軸: 既に退職済みならスキップ
  if (input.retirementAge > input.currentAge) {
    const incomeRx = binarySearchAxis("income", seededInput, targetRate);
    if (incomeRx) prescriptions.push(incomeRx);
  }

  // allocation軸: フロンティアが渡された場合のみ
  if (frontier && frontier.length > 0) {
    const allocationRx = searchFrontierAxis(seededInput, targetRate, frontier);
    if (allocationRx) prescriptions.push(allocationRx);
  }

  // difficulty順にソート: easy → moderate → hard
  const diffOrder: Record<Difficulty, number> = { easy: 0, moderate: 1, hard: 2 };
  prescriptions.sort((a, b) => diffOrder[a.difficulty] - diffOrder[b.difficulty]);

  return {
    targetRate,
    currentRate,
    prescriptions,
    alreadyAchieved: false,
  };
}

export type { Prescription, PrescriptionAxis, PrescriptionResult, Difficulty };
