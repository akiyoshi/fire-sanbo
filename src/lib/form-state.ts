import type { SimulationInput } from "@/lib/simulation";
import type { PortfolioEntry, TaxCategory } from "@/lib/portfolio";
import type { PensionInput, RetirementBonusInput, SideIncomeInput, LifeEvent, NisaConfig, SpouseInput } from "@/lib/simulation";
import { calcPortfolio } from "@/lib/portfolio";

export interface SpouseFormState {
  currentAge: number;
  retirementAge: number;
  annualSalary: number;
  portfolio: PortfolioEntry[];
  idecoYearsOfService: number;
  tokuteiGainRatio: number;
  goldGainRatio: number;
  pension?: PensionInput;
  retirementBonus?: RetirementBonusInput;
  sideIncome?: SideIncomeInput;
  nisaConfig?: NisaConfig;
}

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
  inflationRate: number;
  numTrials: number;

  /* v0.9 拡張フィールド（すべてオプショナル） */
  pension?: PensionInput;
  retirementBonus?: RetirementBonusInput;
  sideIncome?: SideIncomeInput;
  lifeEvents?: LifeEvent[];
  nisaConfig?: NisaConfig;

  /* v1.0 拡張: 世帯シミュレーション */
  spouse?: SpouseFormState;
  /** 配偶者セクション表示フラグ（false でも spouse データは保持） */
  spouseEnabled?: boolean;

  /* v4.0 拡張: 取り崩し順序 */
  withdrawalOrder?: TaxCategory[];
}

/* ---------- シナリオ管理 ---------- */

export interface Scenario {
  id: string;
  name: string;
  form: FormState;
  createdAt: string;
  updatedAt: string;
}

const SCENARIOS_KEY = "fire-sanbo-scenarios";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function loadScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Scenario[];
  } catch {
    return [];
  }
}

export function saveScenarios(scenarios: Scenario[]): void {
  try {
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios));
  } catch {
    // localStorage 満杯等 → 無視
  }
}

export function saveScenario(name: string, form: FormState): Scenario {
  const scenarios = loadScenarios();
  const now = new Date().toISOString();
  const scenario: Scenario = { id: generateId(), name, form, createdAt: now, updatedAt: now };
  scenarios.push(scenario);
  saveScenarios(scenarios);
  return scenario;
}

export function updateScenario(id: string, form: FormState): void {
  const scenarios = loadScenarios();
  const idx = scenarios.findIndex((s) => s.id === id);
  if (idx >= 0) {
    scenarios[idx] = { ...scenarios[idx], form, updatedAt: new Date().toISOString() };
    saveScenarios(scenarios);
  }
}

export function deleteScenario(id: string): void {
  const scenarios = loadScenarios().filter((s) => s.id !== id);
  saveScenarios(scenarios);
}

/* ---------- JSON エクスポート/インポート ---------- */

export function exportFormToJSON(form: FormState): string {
  return JSON.stringify({ version: FORM_SCHEMA_VERSION, form }, null, 2);
}

export function importFormFromJSON(json: string): FormState | null {
  try {
    const data = JSON.parse(json);
    const form = data.form;
    // 基本的なバリデーション（v2/v3共通）
    if (!form || typeof form !== "object") return null;
    if (typeof form.currentAge !== "number" || typeof form.monthlyExpense !== "number") return null;
    if (typeof form.retirementAge !== "number" || typeof form.endAge !== "number") return null;
    if (typeof form.annualSalary !== "number") return null;
    if (!Array.isArray(form.portfolio)) return null;
    if (form.portfolio.length > 20) return null;
    for (const entry of form.portfolio) {
      if (typeof entry.assetClass !== "string" || typeof entry.taxCategory !== "string" || typeof entry.amount !== "number") {
        return null;
      }
    }
    if (form.lifeEvents && (!Array.isArray(form.lifeEvents) || form.lifeEvents.length > 30)) return null;
    if (form.spouse && typeof form.spouse === "object") {
      if (form.spouse.portfolio && (!Array.isArray(form.spouse.portfolio) || form.spouse.portfolio.length > 20)) return null;
    }
    if (data.version === 2) {
      return migrateV3toV4(migrateV2toV3(form as Record<string, unknown>) as unknown as Record<string, unknown>);
    }
    if (data.version === 3) {
      return migrateV3toV4(form as Record<string, unknown>);
    }
    if (data.version !== FORM_SCHEMA_VERSION) return null;
    return form as FormState;
  } catch {
    return null;
  }
}

export const DEFAULT_FORM: FormState = {
  currentAge: 35,
  retirementAge: 50,
  endAge: 95,
  annualSalary: 6_000_000,
  monthlyExpense: 250_000,
  portfolio: [
    { id: "default-1", assetClass: "developed_stock", taxCategory: "nisa", amount: 0 },
  ],
  idecoYearsOfService: 15,
  tokuteiGainRatio: 50,
  goldGainRatio: 30,
  inflationRate: 2.0,
  numTrials: 1000,
  pension: { kosei: 100_000, kokumin: 65_000, startAge: 65 },
  retirementBonus: { amount: 0, yearsOfService: 20 },
  sideIncome: undefined,
  lifeEvents: [],
  nisaConfig: { annualLimit: 3_600_000, lifetimeLimit: 18_000_000 },
};

/* ---------- localStorage 永続化 ---------- */

const STORAGE_KEY = "fire-sanbo-form";
const FORM_SCHEMA_VERSION = 4;

interface StoredForm {
  version: number;
  form: FormState;
}

const VALID_TAX_CATEGORIES: TaxCategory[] = ["cash", "nisa", "tokutei", "ideco", "gold_physical"];

/** v3 → v4 マイグレーション: withdrawalOrder 追加 */
function migrateV3toV4(form: Record<string, unknown>): FormState {
  return { ...DEFAULT_FORM, ...(form as Partial<FormState>) };
}

/** v2 → v3 マイグレーション: 新フィールドにデフォルト値を注入 */
function migrateV2toV3(form: Record<string, unknown>): FormState {
  return {
    ...DEFAULT_FORM,
    ...(form as Partial<FormState>),
    pension: (form as Partial<FormState>).pension ?? DEFAULT_FORM.pension,
    retirementBonus: (form as Partial<FormState>).retirementBonus ?? DEFAULT_FORM.retirementBonus,
    lifeEvents: (form as Partial<FormState>).lifeEvents ?? [],
    nisaConfig: (form as Partial<FormState>).nisaConfig ?? DEFAULT_FORM.nisaConfig,
  };
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
    if (data.version === FORM_SCHEMA_VERSION) return data.form;
    if (data.version === 3) return migrateV3toV4(data.form as unknown as Record<string, unknown>);
    if (data.version === 2) return migrateV3toV4(migrateV2toV3(data.form as unknown as Record<string, unknown>) as unknown as Record<string, unknown>);
    return null;
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
  const result: Record<TaxCategory, number> = { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0 };
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

  const currentAge = safeNum(form.currentAge, 35, 18);
  const retirementAge = Math.min(Math.max(safeNum(form.retirementAge, 50, 19), currentAge + 1), 120);
  const endAge = Math.min(Math.max(safeNum(form.endAge, 95, 60), retirementAge + 1), 120);

  return {
    currentAge,
    retirementAge,
    endAge,
    annualSalary: safeNum(form.annualSalary),
    annualExpense: safeNum(form.monthlyExpense) * 12,
    accounts: {
      nisa: balances.nisa,
      tokutei: balances.tokutei,
      ideco: balances.ideco,
      gold_physical: balances.gold_physical,
      cash: balances.cash,
    },
    allocation: {
      expectedReturn,
      standardDeviation,
    },
    idecoYearsOfService: safeNum(form.idecoYearsOfService, 20, 1),
    tokuteiGainRatio: safeNum(form.tokuteiGainRatio, 50) / 100,
    goldGainRatio: safeNum(form.goldGainRatio, 30) / 100,
    inflationRate: safeNum(form.inflationRate, 2.0) / 100,
    withdrawalOrder: (form.withdrawalOrder && Array.isArray(form.withdrawalOrder)
      && form.withdrawalOrder.every((c: TaxCategory) => VALID_TAX_CATEGORIES.includes(c)))
      ? form.withdrawalOrder
      : ["cash", "nisa", "tokutei", "gold_physical", "ideco"],
    numTrials: Math.min(safeNum(form.numTrials, 1000, 10), 10_000),
    seed: Math.floor(Math.random() * 2 ** 32),

    // v0.9 拡張 (safeNum で負値・NaN 防御)
    pension: form.pension ? {
      kosei: safeNum(form.pension.kosei, 0),
      kokumin: safeNum(form.pension.kokumin, 0),
      startAge: Math.min(Math.max(safeNum(form.pension.startAge, 65, 60), 60), 75),
    } : undefined,
    retirementBonus: form.retirementBonus ? {
      amount: safeNum(form.retirementBonus.amount, 0),
      yearsOfService: safeNum(form.retirementBonus.yearsOfService, 20, 1),
    } : undefined,
    sideIncome: form.sideIncome ? {
      annualAmount: safeNum(form.sideIncome.annualAmount, 0),
      untilAge: Math.min(safeNum(form.sideIncome.untilAge, 70, currentAge), 120),
    } : undefined,
    lifeEvents: form.lifeEvents?.map((e) => ({
      ...e,
      age: Math.min(safeNum(e.age, currentAge, currentAge), endAge),
      amount: safeNum(e.amount, 0),
    })),
    nisaConfig: form.nisaConfig ? {
      annualLimit: safeNum(form.nisaConfig.annualLimit, 3_600_000),
      lifetimeLimit: safeNum(form.nisaConfig.lifetimeLimit, 18_000_000),
    } : undefined,

    // v1.0 世帯シミュレーション
    spouse: (form.spouse && form.spouseEnabled !== false) ? spouseFormToInput(form.spouse) : undefined,
  };
}

function spouseFormToInput(sp: SpouseFormState): SpouseInput {
  const portfolioResult = calcPortfolio(sp.portfolio);
  const expectedReturn = portfolioResult.totalAmount > 0 ? portfolioResult.expectedReturn : 0.05;
  const standardDeviation = portfolioResult.totalAmount > 0 ? Math.max(0.001, portfolioResult.risk) : 0.15;
  const balances = deriveBalancesByTaxCategory(sp.portfolio);

  const currentAge = safeNum(sp.currentAge, 35, 18);
  const retirementAge = Math.min(Math.max(safeNum(sp.retirementAge, 55, 19), currentAge + 1), 120);

  return {
    currentAge,
    retirementAge,
    annualSalary: safeNum(sp.annualSalary),
    accounts: {
      nisa: balances.nisa,
      tokutei: balances.tokutei,
      ideco: balances.ideco,
      gold_physical: balances.gold_physical,
      cash: balances.cash,
    },
    allocation: { expectedReturn, standardDeviation },
    idecoYearsOfService: safeNum(sp.idecoYearsOfService, 20, 1),
    tokuteiGainRatio: safeNum(sp.tokuteiGainRatio, 50) / 100,
    goldGainRatio: safeNum(sp.goldGainRatio, 30) / 100,
    pension: sp.pension ? {
      kosei: safeNum(sp.pension.kosei, 0),
      kokumin: safeNum(sp.pension.kokumin, 0),
      startAge: Math.min(Math.max(safeNum(sp.pension.startAge, 65, 60), 60), 75),
    } : undefined,
    retirementBonus: sp.retirementBonus ? {
      amount: safeNum(sp.retirementBonus.amount, 0),
      yearsOfService: safeNum(sp.retirementBonus.yearsOfService, 20, 1),
    } : undefined,
    sideIncome: sp.sideIncome ? {
      annualAmount: safeNum(sp.sideIncome.annualAmount, 0),
      untilAge: Math.min(safeNum(sp.sideIncome.untilAge, 70, currentAge), 120),
    } : undefined,
    nisaConfig: sp.nisaConfig ? {
      annualLimit: safeNum(sp.nisaConfig.annualLimit, 3_600_000),
      lifetimeLimit: safeNum(sp.nisaConfig.lifetimeLimit, 18_000_000),
    } : undefined,
  };
}
