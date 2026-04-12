import type { SimulationInput } from "@/lib/simulation";
import type { PortfolioEntry, TaxCategory } from "@/lib/portfolio";
import { calcPortfolio } from "@/lib/portfolio";

export interface FormState {
  currentAge: number;
  retirementAge: number;
  endAge: number;
  annualSalary: number;
  monthlyExpense: number;
  portfolio: PortfolioEntry[];
  idecoYearsOfService: number;
  tokuteiGainRatio: number;
  goldGainRatio: number;
  numTrials: number;
}

export const DEFAULT_FORM: FormState = {
  currentAge: 35,
  retirementAge: 50,
  endAge: 95,
  annualSalary: 6_000_000,
  monthlyExpense: 250_000,
  portfolio: [
    { assetClass: "developed_stock", taxCategory: "nisa", amount: 0 },
  ],
  idecoYearsOfService: 15,
  tokuteiGainRatio: 50,
  goldGainRatio: 30,
  numTrials: 1000,
};

/* ---------- localStorage 永続化 ---------- */

const STORAGE_KEY = "fire-sanbo-form";
const FORM_SCHEMA_VERSION = 1;

interface StoredForm {
  version: number;
  form: FormState;
}

export function saveForm(form: FormState): void {
  try {
    const data: StoredForm = { version: FORM_SCHEMA_VERSION, form };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage 満杯・プライベートモード等 → 黙って無視
  }
}

export function loadForm(): FormState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: StoredForm = JSON.parse(raw);
    if (data.version !== FORM_SCHEMA_VERSION) return null;
    return data.form;
  } catch {
    return null;
  }
}

export function clearForm(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無視
  }
}

/** NaN/undefined/負値を安全な値に変換 */
function safeNum(v: unknown, fallback = 0, min = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, n);
}

/** ポートフォリオから課税種別ごとの残高を集計 */
export function deriveBalancesByTaxCategory(portfolio: PortfolioEntry[]): Record<TaxCategory, number> {
  const result: Record<TaxCategory, number> = { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0 };
  for (const entry of portfolio) {
    if (entry.taxCategory in result) {
      result[entry.taxCategory] += entry.amount;
    }
  }
  return result;
}

export function formToSimulationInput(form: FormState): SimulationInput {
  // ポートフォリオから合成リターン・リスクを自動計算
  const portfolioResult = calcPortfolio(form.portfolio);
  const expectedReturn = portfolioResult.totalAmount > 0
    ? portfolioResult.expectedReturn
    : 0.05;
  const standardDeviation = portfolioResult.totalAmount > 0
    ? Math.max(0.001, portfolioResult.risk)
    : 0.15;

  // 残高を課税種別から自動集計
  const balances = deriveBalancesByTaxCategory(form.portfolio);

  return {
    currentAge: safeNum(form.currentAge, 35, 18),
    retirementAge: safeNum(form.retirementAge, 50, 19),
    endAge: safeNum(form.endAge, 95, 60),
    annualSalary: safeNum(form.annualSalary),
    annualExpense: safeNum(form.monthlyExpense) * 12,
    accounts: {
      nisa: balances.nisa,
      tokutei: balances.tokutei,
      ideco: balances.ideco,
      gold_physical: balances.gold_physical,
    },
    allocation: {
      expectedReturn,
      standardDeviation,
    },
    idecoYearsOfService: safeNum(form.idecoYearsOfService, 20, 1),
    tokuteiGainRatio: safeNum(form.tokuteiGainRatio, 50) / 100,
    goldGainRatio: safeNum(form.goldGainRatio, 30) / 100,
    withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
    numTrials: safeNum(form.numTrials, 1000, 10),
    seed: Math.floor(Math.random() * 2 ** 32),
  };
}
