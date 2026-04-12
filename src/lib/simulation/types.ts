/** シミュレーションの入力パラメータと結果の型定義 */

export interface AccountBalance {
  nisa: number;
  tokutei: number;
  ideco: number;
  gold_physical: number;
  cash: number;
}

export interface AssetAllocation {
  /** 期待リターン（年率, e.g. 0.05 = 5%） */
  expectedReturn: number;
  /** 標準偏差（年率, e.g. 0.15 = 15%） */
  standardDeviation: number;
}

/* ---------- v0.9 拡張: 年金・退職金・副収入・ライフイベント・NISA枠 ---------- */

export interface PensionInput {
  /** 厚生年金の見込み月額（ねんきん定期便の値） */
  kosei: number;
  /** 国民年金の見込み月額（満額: 68,000円） */
  kokumin: number;
  /** 受給開始年齢（60-75歳、デフォルト65歳） */
  startAge: number;
}

export interface RetirementBonusInput {
  /** 退職金の見込み額 */
  amount: number;
  /** 勤続年数（退職所得控除の計算用） */
  yearsOfService: number;
}

export interface SideIncomeInput {
  /** 退職後の年間副収入（税引前） */
  annualAmount: number;
  /** 副収入が続く年齢の上限 */
  untilAge: number;
}

export interface LifeEvent {
  /** 一意識別子（UI用、エンジンでは無視） */
  id?: string;
  /** イベント名 */
  label: string;
  /** 発生年齢 */
  age: number;
  /** 金額（円） */
  amount: number;
}

export interface NisaConfig {
  /** 年間投資枠（円、デフォルト3,600,000） */
  annualLimit: number;
  /** 生涯投資枠（円、デフォルト18,000,000） */
  lifetimeLimit: number;
}

/* ---------- v1.0 拡張: 世帯シミュレーション ---------- */

export interface SpouseInput {
  currentAge: number;
  retirementAge: number;
  annualSalary: number;
  accounts: AccountBalance;
  allocation: AssetAllocation;
  pension?: PensionInput;
  retirementBonus?: RetirementBonusInput;
  sideIncome?: SideIncomeInput;
  nisaConfig?: NisaConfig;
  idecoYearsOfService: number;
  tokuteiGainRatio: number;
  goldGainRatio: number;
}

export interface SimulationInput {
  currentAge: number;
  retirementAge: number;
  endAge: number;
  annualSalary: number;
  annualExpense: number;
  accounts: AccountBalance;
  allocation: AssetAllocation;
  /** iDeCoの勤続年数（退職所得控除用） */
  idecoYearsOfService: number;
  /** 特定口座の含み益率 (0-1) */
  tokuteiGainRatio: number;
  /** 金現物の含み益率 (0-1) */
  goldGainRatio: number;
  /** 取り崩し順序 */
  withdrawalOrder: ("nisa" | "tokutei" | "ideco" | "gold_physical" | "cash")[];
  /** シミュレーション試行回数 */
  numTrials: number;
  /** 想定インフレ率（年率, e.g. 0.02 = 2%） */
  inflationRate: number;
  /** 乱数シード（再現性用、省略時はランダム） */
  seed?: number;

  /* v0.9 拡張フィールド（すべてオプショナル、後方互換） */

  /** 年金入力 */
  pension?: PensionInput;
  /** 退職金入力 */
  retirementBonus?: RetirementBonusInput;
  /** 退職後の副収入 */
  sideIncome?: SideIncomeInput;
  /** ライフイベント（一時支出） */
  lifeEvents?: LifeEvent[];
  /** NISA積立枠設定 */
  nisaConfig?: NisaConfig;
  /** 配偶者（世帯シミュレーション用） */
  spouse?: SpouseInput;
}

export interface TaxBreakdown {
  incomeTax: number;
  residentTax: number;
  socialInsurance: number;
  withdrawalTax: number;
  total: number;
}

export interface YearResult {
  age: number;
  totalAssets: number;
  nisa: number;
  tokutei: number;
  ideco: number;
  gold_physical: number;
  cash: number;
  income: number;
  expense: number;
  taxBreakdown: TaxBreakdown;
  withdrawal: number;
  portfolioReturn: number;
}

export interface TrialResult {
  /** 各年の資産推移 */
  years: YearResult[];
  /** 成功（endAgeまで資産 > 0） */
  success: boolean;
  /** 資産枯渇年齢（枯渇しない場合はnull） */
  depletionAge: number | null;
  /** 最終資産 */
  finalAssets: number;
}

export interface SimulationResult {
  /** 成功確率 (0-1) */
  successRate: number;
  /** 各試行の結果 */
  trials: TrialResult[];
  /** パーセンタイル別の資産推移 */
  percentiles: {
    p5: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
  };
  /** 各年齢のラベル */
  ages: number[];
}
