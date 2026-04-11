import type {
  SimulationInput,
  SimulationResult,
  TrialResult,
  YearResult,
} from "./types";
import { PRNG, generateLogNormalReturn } from "./random";
import { calcAnnualTax, calcWithdrawalTax, calcSocialInsurancePremium } from "@/lib/tax";
import type { AccountType } from "@/lib/tax";

/**
 * 1回の試行（currentAge → endAge までの年次シミュレーション）
 */
function runTrial(input: SimulationInput, rng: PRNG): TrialResult {
  let nisa = input.accounts.nisa;
  let tokutei = input.accounts.tokutei;
  let ideco = input.accounts.ideco;
  const years: YearResult[] = [];
  let depletionAge: number | null = null;

  for (let age = input.currentAge; age <= input.endAge; age++) {
    const totalAssetsBefore = nisa + tokutei + ideco;

    // 収入（退職前のみ）
    let income = 0;
    let tax = 0;
    if (age < input.retirementAge) {
      const taxResult = calcAnnualTax(input.annualSalary, age);
      income = taxResult.netIncome;
      tax = taxResult.totalTax;
    }

    // 退職後: 必要支出を口座から取り崩し
    let withdrawal = 0;
    if (age >= input.retirementAge) {
      // 退職後の社会保険料（国保+国民年金）を支出に加算
      const retiredSocialInsurance = calcSocialInsurancePremium(0, age);
      const needed = input.annualExpense + retiredSocialInsurance;
      tax += retiredSocialInsurance;
      let remaining = needed;

      for (const accountType of input.withdrawalOrder) {
        if (remaining <= 0) break;

        const balance = getAccountBalance(accountType, nisa, tokutei, ideco);
        if (balance <= 0) continue;

        const withdrawAmount = Math.min(remaining, balance);
        const result = calcWithdrawalTax(accountType, withdrawAmount, {
          yearsOfService: input.idecoYearsOfService,
          gainRatio: input.tokuteiGainRatio,
        });

        // 口座から引き出し
        switch (accountType) {
          case "nisa":
            nisa -= withdrawAmount;
            break;
          case "tokutei":
            tokutei -= withdrawAmount;
            break;
          case "ideco":
            ideco -= withdrawAmount;
            break;
        }

        withdrawal += withdrawAmount;
        tax += result.tax;
        remaining -= result.net;
      }
    }

    // 退職前: 余剰を特定口座に積立
    if (age < input.retirementAge) {
      const surplus = income - input.annualExpense;
      if (surplus > 0) {
        tokutei += surplus;
      }
    }

    // ポートフォリオリターン
    const portfolioReturn = generateLogNormalReturn(
      input.allocation.expectedReturn,
      input.allocation.standardDeviation,
      rng
    );

    nisa = Math.max(0, nisa * (1 + portfolioReturn));
    tokutei = Math.max(0, tokutei * (1 + portfolioReturn));
    ideco = Math.max(0, ideco * (1 + portfolioReturn));

    const totalAssetsAfter = nisa + tokutei + ideco;

    years.push({
      age,
      totalAssets: Math.round(totalAssetsAfter),
      nisa: Math.round(nisa),
      tokutei: Math.round(tokutei),
      ideco: Math.round(ideco),
      income: Math.round(income),
      expense: input.annualExpense,
      tax: Math.round(tax),
      withdrawal: Math.round(withdrawal),
      portfolioReturn,
    });

    // 資産枯渇チェック
    if (totalAssetsAfter <= 0 && age >= input.retirementAge && depletionAge === null) {
      depletionAge = age;
    }
  }

  const finalAssets = nisa + tokutei + ideco;
  return {
    years,
    success: depletionAge === null,
    depletionAge,
    finalAssets: Math.round(finalAssets),
  };
}

function getAccountBalance(
  type: AccountType,
  nisa: number,
  tokutei: number,
  ideco: number
): number {
  switch (type) {
    case "nisa":
      return nisa;
    case "tokutei":
      return tokutei;
    case "ideco":
      return ideco;
  }
}

/**
 * パーセンタイルの資産推移を計算
 */
function calcPercentiles(
  trials: TrialResult[],
  numYears: number
): SimulationResult["percentiles"] {
  const p5: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p95: number[] = [];

  for (let i = 0; i < numYears; i++) {
    const values = trials
      .map((t) => t.years[i]?.totalAssets ?? 0)
      .sort((a, b) => a - b);
    const n = values.length;
    p5.push(values[Math.floor(n * 0.05)] ?? 0);
    p25.push(values[Math.floor(n * 0.25)] ?? 0);
    p50.push(values[Math.floor(n * 0.5)] ?? 0);
    p75.push(values[Math.floor(n * 0.75)] ?? 0);
    p95.push(values[Math.floor(n * 0.95)] ?? 0);
  }

  return { p5, p25, p50, p75, p95 };
}

/**
 * モンテカルロシミュレーションを実行
 */
export function runSimulation(input: SimulationInput): SimulationResult {
  const baseSeed = input.seed ?? Math.floor(Math.random() * 2 ** 32);
  const trials: TrialResult[] = [];

  for (let i = 0; i < input.numTrials; i++) {
    const rng = new PRNG(baseSeed + i);
    trials.push(runTrial(input, rng));
  }

  const successCount = trials.filter((t) => t.success).length;
  const numYears = input.endAge - input.currentAge + 1;
  const ages = Array.from({ length: numYears }, (_, i) => input.currentAge + i);

  return {
    successRate: successCount / input.numTrials,
    trials,
    percentiles: calcPercentiles(trials, numYears),
    ages,
  };
}
