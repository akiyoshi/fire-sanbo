/** 税制設定の型定義 */

export interface TaxBracket {
  from: number;
  to: number | null;
  rate: number;
  deduction: number;
}

export interface DeductionThreshold {
  maxIncome: number | null;
  deduction: number;
}

export interface EmploymentDeductionThreshold {
  maxIncome: number | null;
  deduction?: number;
  rate?: number;
  subtract?: number;
}

export interface RetirementIncomeDeduction {
  yearsThreshold: number;
  belowThresholdPerYear: number;
  aboveThresholdPerYear: number;
  minimumDeduction: number;
  taxableRatio: number;
}

export interface NHIComponent {
  incomeRate: number;
  perCapita: number;
  cap: number;
  minAge?: number;
  maxAge?: number;
}

export interface TaxConfig {
  version: string;
  fiscalYear: number;
  lastUpdated: string;
  incomeTax: {
    brackets: TaxBracket[];
    reconstructionSurtaxRate: number;
    basicDeduction: { thresholds: DeductionThreshold[] };
    employmentIncomeDeduction: { thresholds: EmploymentDeductionThreshold[] };
    retirementIncomeDeduction: RetirementIncomeDeduction;
  };
  residentTax: {
    incomeRate: number;
    perCapita: number;
    forestEnvironmentTax: number;
    basicDeduction: { thresholds: DeductionThreshold[] };
  };
  socialInsurance: {
    nationalHealthInsurance: {
      medical: NHIComponent;
      support: NHIComponent;
      longTermCare: NHIComponent;
      totalCap: number;
      baseDeduction: number;
    };
    nationalPension: {
      monthlyPremium: number;
      annualPremium: number;
    };
  };
  investmentTax: {
    tokuteiRate: number;
    nisaTaxRate: number;
    nisaAnnualLimit: number;
    nisaLifetimeLimit: number;
  };
  ideco: {
    minReceiveAge: number;
    maxReceiveAge: number;
  };
}
