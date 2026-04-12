import type { SimulationInput, PensionInput } from "@/lib/simulation";
import type { PRNG as PRNGType } from "@/lib/simulation";
import type {
  Prescription,
  PrescriptionAxis,
  PrescriptionResult,
  Difficulty,
} from "./types";

// --- runSimulationLite: successRateのみ返す軽量版 ---

import { PRNG, generateLogNormalReturn } from "@/lib/simulation";
import {
  calcAnnualTax,
  calcWithdrawalTax,
  calcSocialInsurancePremium,
  calcPensionTax,
  calcRetirementBonusNet,
  calcSideIncomeTax,
} from "@/lib/tax";
import type { TaxCategory } from "@/lib/tax";

function assertNever(x: never): never {
  throw new Error(`Unexpected tax category: ${x}`);
}

function getBalance(
  type: TaxCategory,
  nisa: number,
  tokutei: number,
  ideco: number,
  gold_physical: number,
): number {
  switch (type) {
    case "nisa":
      return nisa;
    case "tokutei":
      return tokutei;
    case "ideco":
      return ideco;
    case "gold_physical":
      return gold_physical;
    default:
      return assertNever(type);
  }
}

function calcAnnualPension(pension: PensionInput | undefined, age: number): number {
  if (!pension) return 0;
  if (age < pension.startAge) return 0;
  const monthlyBase = pension.kosei + pension.kokumin;
  let adjustmentRate = 1.0;
  if (pension.startAge < 65) {
    adjustmentRate = 1 - (65 - pension.startAge) * 12 * 0.004;
  } else if (pension.startAge > 65) {
    adjustmentRate = 1 + (pension.startAge - 65) * 12 * 0.007;
  }
  return Math.round(monthlyBase * 12 * adjustmentRate);
}

function calcLifeEventExpense(lifeEvents: SimulationInput["lifeEvents"], age: number): number {
  if (!lifeEvents) return 0;
  return lifeEvents.filter((e) => e.age === age).reduce((sum, e) => sum + e.amount, 0);
}

function runTrialLite(input: SimulationInput, rng: PRNGType): boolean {
  let nisa = input.accounts.nisa;
  let tokutei = input.accounts.tokutei;
  let ideco = input.accounts.ideco;
  let gold_physical = input.accounts.gold_physical;

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
      tokutei += bonus.net;
    }

    // 退職後の収入源
    let postRetirementIncome = 0;
    if (age >= input.retirementAge) {
      // 年金
      const pensionIncome = calcAnnualPension(input.pension, age);
      if (pensionIncome > 0) {
        const pensionTax = calcPensionTax(pensionIncome, age);
        postRetirementIncome += pensionIncome - pensionTax.total;
      }
      // 副収入
      if (input.sideIncome && age <= input.sideIncome.untilAge) {
        const sideTax = calcSideIncomeTax(input.sideIncome.annualAmount);
        postRetirementIncome += sideTax.net;
      }
    }

    // ライフイベント
    const lifeEventExpense = calcLifeEventExpense(input.lifeEvents, age);

    // 取り崩しフェーズ（退職後）
    if (age >= input.retirementAge) {
      const retiredSocialInsurance = calcSocialInsurancePremium(0, age);
      const needed = input.annualExpense + retiredSocialInsurance + lifeEventExpense;
      let remaining = Math.max(0, needed - postRetirementIncome);

      for (const taxCategory of input.withdrawalOrder) {
        if (remaining <= 0) break;
        const balance = getBalance(taxCategory, nisa, tokutei, ideco, gold_physical);
        if (balance <= 0) continue;
        const withdrawAmount = Math.min(remaining, balance);
        const result = calcWithdrawalTax(taxCategory, withdrawAmount, {
          yearsOfService: input.idecoYearsOfService,
          gainRatio: input.tokuteiGainRatio,
          goldGainRatio: input.goldGainRatio,
        });
        switch (taxCategory) {
          case "nisa":
            nisa -= withdrawAmount;
            break;
          case "tokutei":
            tokutei -= withdrawAmount;
            break;
          case "ideco":
            ideco -= withdrawAmount;
            break;
          case "gold_physical":
            gold_physical -= withdrawAmount;
            break;
          default:
            assertNever(taxCategory);
        }
        remaining -= result.net;
      }
    }

    // 余剰積立（退職前）
    if (age < input.retirementAge) {
      const surplus = income - input.annualExpense - lifeEventExpense;
      if (surplus > 0) {
        tokutei += surplus;
      } else if (surplus < 0) {
        let deficit = -surplus;
        for (const taxCategory of input.withdrawalOrder) {
          if (deficit <= 0) break;
          const balance = getBalance(taxCategory, nisa, tokutei, ideco, gold_physical);
          if (balance <= 0) continue;
          const draw = Math.min(deficit, balance);
          switch (taxCategory) {
            case "nisa": nisa -= draw; break;
            case "tokutei": tokutei -= draw; break;
            case "ideco": ideco -= draw; break;
            case "gold_physical": gold_physical -= draw; break;
            default: assertNever(taxCategory);
          }
          deficit -= draw;
        }
      }
    }

    // ポートフォリオリターン（実質リターン = 名目リターン − インフレ率）
    const realReturn = input.allocation.expectedReturn - input.inflationRate;
    const portfolioReturn = generateLogNormalReturn(
      realReturn,
      input.allocation.standardDeviation,
      rng,
    );
    nisa = Math.max(0, nisa * (1 + portfolioReturn));
    tokutei = Math.max(0, tokutei * (1 + portfolioReturn));
    ideco = Math.max(0, ideco * (1 + portfolioReturn));
    gold_physical = Math.max(0, gold_physical * (1 + portfolioReturn));

    if (nisa + tokutei + ideco + gold_physical <= 0 && age >= input.retirementAge) {
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

const AXIS_CONFIGS: Record<PrescriptionAxis, AxisConfig> = {
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
  investment: {
    lo: (input) => input.accounts.nisa,
    hi: (input) => input.accounts.nisa + 1_200_000 * 10, // 月10万×10年分のNISA追加
    precision: 100_000,
    apply: (input, value) => ({
      ...input,
      accounts: { ...input.accounts, nisa: value },
    }),
    lowerIsBetter: false,
    current: (input) => input.accounts.nisa,
    label: (cur, tgt) => {
      const diff = tgt - cur;
      const monthly = Math.round(diff / 12 / 10); // 10年分割で月額概算
      return `月${monthly.toLocaleString()}円の追加積立（NISA）`;
    },
    delta: (cur, tgt) => {
      const monthly = Math.round((tgt - cur) / 12 / 10);
      return `+${monthly.toLocaleString()}円/月`;
    },
    difficulty: (cur, tgt) => {
      const monthly = (tgt - cur) / 12 / 10;
      if (monthly <= 20_000) return "easy";
      if (monthly <= 50_000) return "moderate";
      return "hard";
    },
  },
};

function binarySearchAxis(
  axis: PrescriptionAxis,
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

/** 3軸の処方箋を生成 */
export function generatePrescriptions(
  input: SimulationInput,
  targetRate: number,
  seed?: number,
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

  const axes: PrescriptionAxis[] = ["expense", "retirement", "investment"];
  const prescriptions: Prescription[] = [];

  for (const axis of axes) {
    const rx = binarySearchAxis(axis, seededInput, targetRate);
    if (rx) prescriptions.push(rx);
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
