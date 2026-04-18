import type { PortfolioEntry, TaxCategory, TargetAllocation } from "@/lib/portfolio";
import type { PensionInput, RetirementBonusInput, SideIncomeInput, LifeEvent, NisaConfig } from "@/lib/simulation";

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

  /* v4.3 拡張: 目標アセットアロケーション + リバランス */
  /** 目標配分（資産クラスレベル） */
  targetAllocation?: TargetAllocation[];
  /** リバランス有効化フラグ */
  rebalanceEnabled?: boolean;
}

/* ---------- シナリオ ---------- */

export interface Scenario {
  id: string;
  name: string;
  form: FormState;
  createdAt: string;
  updatedAt: string;
}

/* ---------- 定数 ---------- */

export const FORM_SCHEMA_VERSION = 5;

export const VALID_TAX_CATEGORIES: TaxCategory[] = ["cash", "nisa", "tokutei", "ideco", "gold_physical"];

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
