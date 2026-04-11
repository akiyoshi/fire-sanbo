import type { SimulationInput } from "@/lib/simulation";
import type { PortfolioEntry } from "@/lib/portfolio";
import { calcPortfolio } from "@/lib/portfolio";

export interface FormState {
  currentAge: number;
  retirementAge: number;
  endAge: number;
  annualSalary: number;
  monthlyExpense: number;
  nisaBalance: number;
  tokuteiBalance: number;
  idecoBalance: number;
  expectedReturn: number;
  standardDeviation: number;
  idecoYearsOfService: number;
  tokuteiGainRatio: number;
  numTrials: number;
  inputMode: "portfolio" | "manual";
  portfolio: PortfolioEntry[];
}

export const DEFAULT_FORM: FormState = {
  currentAge: 35,
  retirementAge: 50,
  endAge: 95,
  annualSalary: 6_000_000,
  monthlyExpense: 250_000,
  nisaBalance: 3_000_000,
  tokuteiBalance: 5_000_000,
  idecoBalance: 2_000_000,
  expectedReturn: 5,
  standardDeviation: 15,
  idecoYearsOfService: 15,
  tokuteiGainRatio: 50,
  numTrials: 1000,
  inputMode: "portfolio",
  portfolio: [
    { assetClass: "developed_stock", amount: 0 },
  ],
};

/** NaN/undefined/負値を安全な値に変換 */
function safeNum(v: unknown, fallback = 0, min = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, n);
}

export function formToSimulationInput(form: FormState): SimulationInput {
  // ポートフォリオモードの場合、合成リターン・リスクを自動計算
  let expectedReturn = safeNum(form.expectedReturn, 5) / 100;
  let standardDeviation = safeNum(form.standardDeviation, 15, 0.1) / 100;

  if (form.inputMode === "portfolio" && form.portfolio.length > 0) {
    const result = calcPortfolio(form.portfolio);
    if (result.totalAmount > 0) {
      expectedReturn = result.expectedReturn;
      standardDeviation = Math.max(0.001, result.risk);
    }
  }

  return {
    currentAge: safeNum(form.currentAge, 35, 18),
    retirementAge: safeNum(form.retirementAge, 50, 19),
    endAge: safeNum(form.endAge, 95, 60),
    annualSalary: safeNum(form.annualSalary),
    annualExpense: safeNum(form.monthlyExpense) * 12,
    accounts: {
      nisa: safeNum(form.nisaBalance),
      tokutei: safeNum(form.tokuteiBalance),
      ideco: safeNum(form.idecoBalance),
    },
    allocation: {
      expectedReturn,
      standardDeviation,
    },
    idecoYearsOfService: safeNum(form.idecoYearsOfService, 20, 1),
    tokuteiGainRatio: safeNum(form.tokuteiGainRatio, 50) / 100,
    withdrawalOrder: ["nisa", "tokutei", "ideco"],
    numTrials: safeNum(form.numTrials, 1000, 10),
    seed: Math.floor(Math.random() * 2 ** 32),
  };
}
