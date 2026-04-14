import type {
  SimulationInput,
  SimulationResult,
  TrialResult,
  YearResult,
  TaxBreakdown,
  PensionInput,
} from "./types";
import { PRNG, generateLogNormalReturn } from "./random";
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

/**
 * 年金の年間受給額を計算（繰上げ/繰下げ調整込み）
 */
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

/**
 * ライフイベントの一時支出を計算
 */
function calcLifeEventExpense(lifeEvents: SimulationInput["lifeEvents"], age: number): number {
  if (!lifeEvents) return 0;
  return lifeEvents
    .filter((e) => e.age === age)
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * 1回の試行（currentAge → endAge までの年次シミュレーション）
 * 配偶者が設定されている場合は世帯シミュレーション
 */
function runTrial(input: SimulationInput, rng: PRNG): TrialResult {
  // --- Primary 口座 ---
  let pNisa = input.accounts.nisa;
  let pTokutei = input.accounts.tokutei;
  let pIdeco = input.accounts.ideco;
  let pGold = input.accounts.gold_physical;
  let pCash = input.accounts.cash;
  let pNisaCumulative = pNisa;

  // --- Spouse 口座 ---
  const sp = input.spouse;
  let sNisa = sp?.accounts.nisa ?? 0;
  let sTokutei = sp?.accounts.tokutei ?? 0;
  let sIdeco = sp?.accounts.ideco ?? 0;
  let sGold = sp?.accounts.gold_physical ?? 0;
  let sCash = sp?.accounts.cash ?? 0;
  let sNisaCumulative = sNisa;

  const years: YearResult[] = [];
  let depletionAge: number | null = null;

  for (let age = input.currentAge; age <= input.endAge; age++) {
    const spouseAge = sp ? sp.currentAge + (age - input.currentAge) : 0;
    const taxBd: TaxBreakdown = { incomeTax: 0, residentTax: 0, socialInsurance: 0, withdrawalTax: 0, total: 0 };

    // ====== 収入フェーズ ======

    // Primary: 退職前の給与所得
    let pIncome = 0;
    if (age < input.retirementAge) {
      const taxResult = calcAnnualTax(input.annualSalary, age);
      pIncome = taxResult.netIncome;
      taxBd.incomeTax += taxResult.incomeTax;
      taxBd.residentTax += taxResult.residentTax;
      taxBd.socialInsurance += taxResult.socialInsurance;
    }

    // Spouse: 退職前の給与所得
    let sIncome = 0;
    if (sp && spouseAge >= 18 && spouseAge < sp.retirementAge) {
      const taxResult = calcAnnualTax(sp.annualSalary, spouseAge);
      sIncome = taxResult.netIncome;
      taxBd.incomeTax += taxResult.incomeTax;
      taxBd.residentTax += taxResult.residentTax;
      taxBd.socialInsurance += taxResult.socialInsurance;
    }

    // ====== 退職金フェーズ ======

    // Primary 退職金
    if (input.retirementBonus && age === input.retirementAge && input.retirementBonus.amount > 0) {
      const bonus = calcRetirementBonusNet(input.retirementBonus.amount, input.retirementBonus.yearsOfService);
      pTokutei += bonus.net;
      taxBd.withdrawalTax += bonus.tax;
    }

    // Spouse 退職金
    if (sp?.retirementBonus && spouseAge === sp.retirementAge && sp.retirementBonus.amount > 0) {
      const bonus = calcRetirementBonusNet(sp.retirementBonus.amount, sp.retirementBonus.yearsOfService);
      sTokutei += bonus.net;
      taxBd.withdrawalTax += bonus.tax;
    }

    // ====== 退職後の収入源 ======
    let postRetirementIncome = 0;

    // Primary 年金
    if (age >= input.retirementAge) {
      const pensionIncome = calcAnnualPension(input.pension, age);
      if (pensionIncome > 0) {
        const pensionTax = calcPensionTax(pensionIncome, age);
        postRetirementIncome += pensionIncome - pensionTax.total;
        taxBd.incomeTax += pensionTax.incomeTax;
        taxBd.residentTax += pensionTax.residentTax;
      }
    }

    // Spouse 年金
    if (sp && spouseAge >= sp.retirementAge) {
      const pensionIncome = calcAnnualPension(sp.pension, spouseAge);
      if (pensionIncome > 0) {
        const pensionTax = calcPensionTax(pensionIncome, spouseAge);
        postRetirementIncome += pensionIncome - pensionTax.total;
        taxBd.incomeTax += pensionTax.incomeTax;
        taxBd.residentTax += pensionTax.residentTax;
      }
    }

    // Primary 副収入
    if (age >= input.retirementAge && input.sideIncome && age <= input.sideIncome.untilAge) {
      const sideTax = calcSideIncomeTax(input.sideIncome.annualAmount);
      postRetirementIncome += sideTax.net;
      taxBd.incomeTax += sideTax.incomeTax;
      taxBd.residentTax += sideTax.residentTax;
    }

    // Spouse 副収入
    if (sp?.sideIncome && spouseAge >= sp.retirementAge && spouseAge <= sp.sideIncome.untilAge) {
      const sideTax = calcSideIncomeTax(sp.sideIncome.annualAmount);
      postRetirementIncome += sideTax.net;
      taxBd.incomeTax += sideTax.incomeTax;
      taxBd.residentTax += sideTax.residentTax;
    }

    // ====== 支出・取り崩しフェーズ ======
    const lifeEventExpense = calcLifeEventExpense(input.lifeEvents, age);
    let withdrawal = 0;

    // 世帯の誰かが退職済みかどうか
    const primaryRetired = age >= input.retirementAge;
    const spouseRetired = sp ? spouseAge >= sp.retirementAge : false;
    const anyRetired = primaryRetired || spouseRetired;

    if (anyRetired) {
      // 退職者の社会保険料
      const pSocialIns = primaryRetired ? calcSocialInsurancePremium(0, age) : 0;
      const sSocialIns = sp && spouseRetired ? calcSocialInsurancePremium(0, spouseAge) : 0;
      taxBd.socialInsurance += pSocialIns + sSocialIns;

      // 世帯全体の必要額 = 生活費 + 社保(退職者分) + ライフイベント − 在職者の手取り − 年金・副収入
      const totalSocialInsurance = pSocialIns + sSocialIns;
      const totalNeeded = input.annualExpense + totalSocialInsurance + lifeEventExpense;
      const workerIncome = (!primaryRetired ? pIncome : 0) + (!spouseRetired ? sIncome : 0);
      let remaining = Math.max(0, totalNeeded - workerIncome - postRetirementIncome);

      // 取り崩し: Primary口座 → Spouse口座 の順（各々withdrawal order順）
      for (const pass of [0, 1]) {
        if (remaining <= 0) break;
        const isPrimary = pass === 0;
        if (pass === 1 && !sp) break;

        const txOpts = isPrimary
          ? { yearsOfService: input.idecoYearsOfService, gainRatio: input.tokuteiGainRatio, goldGainRatio: input.goldGainRatio }
          : { yearsOfService: sp!.idecoYearsOfService, gainRatio: sp!.tokuteiGainRatio, goldGainRatio: sp!.goldGainRatio };

        for (const taxCategory of input.withdrawalOrder) {
          if (remaining <= 0) break;

          const balance = isPrimary
            ? getAccountBalance(taxCategory, pNisa, pTokutei, pIdeco, pGold, pCash)
            : getAccountBalance(taxCategory, sNisa, sTokutei, sIdeco, sGold, sCash);
          if (balance <= 0) continue;

          const withdrawAmount = Math.min(remaining, balance);
          const result = calcWithdrawalTax(taxCategory, withdrawAmount, txOpts);

          if (isPrimary) {
            switch (taxCategory) {
              case "nisa": pNisa -= withdrawAmount; break;
              case "tokutei": pTokutei -= withdrawAmount; break;
              case "ideco": pIdeco -= withdrawAmount; break;
              case "gold_physical": pGold -= withdrawAmount; break;
              case "cash": pCash -= withdrawAmount; break;
              default: assertNever(taxCategory);
            }
          } else {
            switch (taxCategory) {
              case "nisa": sNisa -= withdrawAmount; break;
              case "tokutei": sTokutei -= withdrawAmount; break;
              case "ideco": sIdeco -= withdrawAmount; break;
              case "gold_physical": sGold -= withdrawAmount; break;
              case "cash": sCash -= withdrawAmount; break;
              default: assertNever(taxCategory);
            }
          }

          withdrawal += withdrawAmount;
          taxBd.withdrawalTax += result.tax;
          remaining -= result.net;
        }
      }
    }

    // ====== 余剰積立 / 赤字取り崩しフェーズ ======
    // 在職者は自分の費用負担分を差し引いた余剰を積立。
    // 赤字（生活費が手取りを超える）の場合は口座から取り崩す。

    const totalExpense = input.annualExpense + lifeEventExpense;

    // 在職者の費用負担額を計算
    const numWorkers = (!primaryRetired ? 1 : 0) + (sp && !spouseRetired ? 1 : 0);
    const pExpenseShare = !primaryRetired
      ? (sp ? totalExpense / Math.max(numWorkers, 1) : totalExpense)
      : 0;
    const sExpenseShare = (sp && !spouseRetired)
      ? totalExpense / Math.max(numWorkers, 1)
      : 0;

    // Primary: 退職前の余剰積立 / 赤字取り崩し
    if (!primaryRetired) {
      const surplus = pIncome - pExpenseShare;
      if (surplus > 0) {
        const nc = input.nisaConfig;
        if (nc) {
          const lifetimeRemaining = nc.lifetimeLimit - pNisaCumulative;
          const annualAllowance = Math.min(nc.annualLimit, Math.max(0, lifetimeRemaining));
          const toNisa = Math.min(surplus, annualAllowance);
          if (toNisa > 0) { pNisa += toNisa; pNisaCumulative += toNisa; }
          const toTokutei = surplus - toNisa;
          if (toTokutei > 0) pTokutei += toTokutei;
        } else {
          pTokutei += surplus;
        }
      } else if (surplus < 0) {
        // 赤字: ライフイベント等で支出が手取りを超える場合
        let deficit = -surplus;
        for (const taxCategory of input.withdrawalOrder) {
          if (deficit <= 0) break;
          const balance = getAccountBalance(taxCategory, pNisa, pTokutei, pIdeco, pGold, pCash);
          if (balance <= 0) continue;
          const draw = Math.min(deficit, balance);
          switch (taxCategory) {
            case "nisa": pNisa -= draw; break;
            case "tokutei": pTokutei -= draw; break;
            case "ideco": pIdeco -= draw; break;
            case "gold_physical": pGold -= draw; break;
            case "cash": pCash -= draw; break;
            default: assertNever(taxCategory);
          }
          withdrawal += draw;
          deficit -= draw;
        }
      }
    }

    // Spouse: 退職前の余剰積立 / 赤字取り崩し
    if (sp && spouseAge >= 18 && !spouseRetired) {
      const surplus = sIncome - sExpenseShare;
      if (surplus > 0) {
        const nc = sp.nisaConfig;
        if (nc) {
          const lifetimeRemaining = nc.lifetimeLimit - sNisaCumulative;
          const annualAllowance = Math.min(nc.annualLimit, Math.max(0, lifetimeRemaining));
          const toNisa = Math.min(surplus, annualAllowance);
          if (toNisa > 0) { sNisa += toNisa; sNisaCumulative += toNisa; }
          const toTokutei = surplus - toNisa;
          if (toTokutei > 0) sTokutei += toTokutei;
        } else {
          sTokutei += surplus;
        }
      } else if (surplus < 0) {
        let deficit = -surplus;
        for (const taxCategory of input.withdrawalOrder) {
          if (deficit <= 0) break;
          const balance = getAccountBalance(taxCategory, sNisa, sTokutei, sIdeco, sGold, sCash);
          if (balance <= 0) continue;
          const draw = Math.min(deficit, balance);
          switch (taxCategory) {
            case "nisa": sNisa -= draw; break;
            case "tokutei": sTokutei -= draw; break;
            case "ideco": sIdeco -= draw; break;
            case "gold_physical": sGold -= draw; break;
            case "cash": sCash -= draw; break;
            default: assertNever(taxCategory);
          }
          withdrawal += draw;
          deficit -= draw;
        }
      }
    }

    // ====== ポートフォリオリターン ======
    const pRealReturn = input.allocation.expectedReturn - input.inflationRate;
    const pReturn = generateLogNormalReturn(pRealReturn, input.allocation.standardDeviation, rng);
    pNisa = Math.max(0, pNisa * (1 + pReturn));
    pTokutei = Math.max(0, pTokutei * (1 + pReturn));
    pIdeco = Math.max(0, pIdeco * (1 + pReturn));
    pGold = Math.max(0, pGold * (1 + pReturn));
    // pCash: 現金はリターンなし（元本維持）

    let sReturn = 0;
    if (sp) {
      const sRealReturn = sp.allocation.expectedReturn - input.inflationRate;
      sReturn = generateLogNormalReturn(sRealReturn, sp.allocation.standardDeviation, rng);
      sNisa = Math.max(0, sNisa * (1 + sReturn));
      sTokutei = Math.max(0, sTokutei * (1 + sReturn));
      sIdeco = Math.max(0, sIdeco * (1 + sReturn));
      sGold = Math.max(0, sGold * (1 + sReturn));
      // sCash: 現金はリターンなし（元本維持）
    }

    // ====== 集計 ======
    const totalAssets = pNisa + pTokutei + pIdeco + pGold + pCash + sNisa + sTokutei + sIdeco + sGold + sCash;

    taxBd.total = Math.round(taxBd.incomeTax + taxBd.residentTax + taxBd.socialInsurance + taxBd.withdrawalTax);
    taxBd.incomeTax = Math.round(taxBd.incomeTax);
    taxBd.residentTax = Math.round(taxBd.residentTax);
    taxBd.socialInsurance = Math.round(taxBd.socialInsurance);
    taxBd.withdrawalTax = Math.round(taxBd.withdrawalTax);

    const totalIncome = pIncome + sIncome + postRetirementIncome;

    years.push({
      age,
      totalAssets: Math.round(totalAssets),
      nisa: Math.round(pNisa + sNisa),
      tokutei: Math.round(pTokutei + sTokutei),
      ideco: Math.round(pIdeco + sIdeco),
      gold_physical: Math.round(pGold + sGold),
      cash: Math.round(pCash + sCash),
      income: Math.round(totalIncome),
      expense: input.annualExpense + lifeEventExpense,
      taxBreakdown: taxBd,
      withdrawal: Math.round(withdrawal),
      portfolioReturn: pReturn,
    });

    if (totalAssets <= 0 && anyRetired && depletionAge === null) {
      depletionAge = age;
    }
  }

  const finalAssets = pNisa + pTokutei + pIdeco + pGold + pCash + sNisa + sTokutei + sIdeco + sGold + sCash;
  return {
    years,
    success: depletionAge === null,
    depletionAge,
    finalAssets: Math.round(finalAssets),
  };
}

function getAccountBalance(
  type: TaxCategory,
  nisa: number,
  tokutei: number,
  ideco: number,
  gold_physical: number,
  cash: number,
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
    case "cash":
      return cash;
    default:
      return assertNever(type);
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
