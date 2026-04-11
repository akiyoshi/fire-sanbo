import type { SimulationInput } from "@/lib/simulation";

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
};

export function formToSimulationInput(form: FormState): SimulationInput {
  return {
    currentAge: form.currentAge,
    retirementAge: form.retirementAge,
    endAge: form.endAge,
    annualSalary: form.annualSalary,
    annualExpense: form.monthlyExpense * 12,
    accounts: {
      nisa: form.nisaBalance,
      tokutei: form.tokuteiBalance,
      ideco: form.idecoBalance,
    },
    allocation: {
      expectedReturn: form.expectedReturn / 100,
      standardDeviation: form.standardDeviation / 100,
    },
    idecoYearsOfService: form.idecoYearsOfService,
    tokuteiGainRatio: form.tokuteiGainRatio / 100,
    withdrawalOrder: ["nisa", "tokutei", "ideco"],
    numTrials: form.numTrials,
    seed: 42,
  };
}
