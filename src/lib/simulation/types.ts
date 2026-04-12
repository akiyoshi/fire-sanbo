/** シミュレーションの入力パラメータと結果の型定義 */

export interface AccountBalance {
  nisa: number;
  tokutei: number;
  ideco: number;
  gold_physical: number;
}

export interface AssetAllocation {
  /** 期待リターン（年率, e.g. 0.05 = 5%） */
  expectedReturn: number;
  /** 標準偏差（年率, e.g. 0.15 = 15%） */
  standardDeviation: number;
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
  withdrawalOrder: ("nisa" | "tokutei" | "ideco" | "gold_physical")[];
  /** シミュレーション試行回数 */
  numTrials: number;
  /** 乱数シード（再現性用、省略時はランダム） */
  seed?: number;
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
