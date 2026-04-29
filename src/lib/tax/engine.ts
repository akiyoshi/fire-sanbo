import type { TaxConfig } from "./types";
import { getTaxConfig } from "@/config/tax-config-index";

const config: TaxConfig = getTaxConfig();

/**
 * 給与所得控除を計算
 */
export function calcEmploymentIncomeDeduction(
  salary: number,
  cfg = config
): number {
  for (const t of cfg.incomeTax.employmentIncomeDeduction.thresholds) {
    if (t.maxIncome === null || salary <= t.maxIncome) {
      if (t.deduction !== undefined) return t.deduction;
      // rate * salary - subtract
      return Math.floor(salary * t.rate! + (t.subtract ?? 0));
    }
  }
  return 0;
}

/**
 * 給与収入 → 給与所得
 */
export function calcEmploymentIncome(salary: number, cfg = config): number {
  return Math.max(0, salary - calcEmploymentIncomeDeduction(salary, cfg));
}

/**
 * 所得に応じた基礎控除（所得税用）
 */
export function calcBasicDeduction(totalIncome: number, cfg = config): number {
  for (const t of cfg.incomeTax.basicDeduction.thresholds) {
    if (t.maxIncome === null || totalIncome <= t.maxIncome) {
      return t.deduction;
    }
  }
  return 0;
}

/**
 * 所得に応じた基礎控除（住民税用）
 */
export function calcResidentBasicDeduction(
  totalIncome: number,
  cfg = config
): number {
  for (const t of cfg.residentTax.basicDeduction.thresholds) {
    if (t.maxIncome === null || totalIncome <= t.maxIncome) {
      return t.deduction;
    }
  }
  return 0;
}

/**
 * 社会保険料控除（国保 + 国民年金）
 */
export function calcSocialInsurancePremium(
  totalIncome: number,
  age: number,
  cfg = config
): number {
  const nhi = cfg.socialInsurance.nationalHealthInsurance;
  const base = Math.max(0, totalIncome - nhi.baseDeduction);

  const medical = Math.min(
    Math.floor(base * nhi.medical.incomeRate) + nhi.medical.perCapita,
    nhi.medical.cap
  );
  const support = Math.min(
    Math.floor(base * nhi.support.incomeRate) + nhi.support.perCapita,
    nhi.support.cap
  );
  let longTermCare = 0;

  if (age >= (nhi.longTermCare.minAge ?? 40) && age <= (nhi.longTermCare.maxAge ?? 64)) {
    longTermCare = Math.min(
      Math.floor(base * nhi.longTermCare.incomeRate) + nhi.longTermCare.perCapita,
      nhi.longTermCare.cap
    );
  }

  // 65歳以上: 介護保険第1号被保険者（市区町村基準額）
  let longTermCareCat1 = 0;
  const cat1 = nhi.longTermCareCategory1;
  if (cat1 && age >= cat1.minAge) {
    longTermCareCat1 = cat1.annualPremium;
  }

  const nhiTotal = Math.min(medical + support + longTermCare, nhi.totalCap);

  // 国民年金: 60歳未満のみ（第1号被保険者の加入期間は20〜59歳）
  const pensionCfg = cfg.socialInsurance.nationalPension;
  const pensionMaxAge = pensionCfg.maxAge ?? 59;
  const pension = age <= pensionMaxAge ? pensionCfg.annualPremium : 0;

  return nhiTotal + longTermCareCat1 + pension;
}

/**
 * 課税所得を計算（所得税用）
 * 所得 - 基礎控除 - 社会保険料控除
 */
export function calcTaxableIncome(
  totalIncome: number,
  socialInsuranceDeduction: number,
  cfg = config
): number {
  const basicDeduction = calcBasicDeduction(totalIncome, cfg);
  return Math.max(
    0,
    Math.floor(totalIncome - basicDeduction - socialInsuranceDeduction)
  );
}

/**
 * 所得税額を計算（累進課税 + 復興特別所得税）
 */
export function calcIncomeTax(taxableIncome: number, cfg = config): number {
  let tax = 0;
  for (const bracket of cfg.incomeTax.brackets) {
    if (taxableIncome <= 0) break;
    if (bracket.to !== null && taxableIncome > bracket.to) continue;
    tax = Math.floor(taxableIncome * bracket.rate - bracket.deduction);
    break;
  }
  tax = Math.max(0, tax);
  // 復興特別所得税
  const surtax = Math.floor(tax * cfg.incomeTax.reconstructionSurtaxRate);
  return tax + surtax;
}

/**
 * 課税所得から限界税率（その所得が属するブラケットの税率）を取得。
 *
 * v4.6.1 (T-7): ふるさと納税の上限算定で必要。`calcAnnualTax` の戻り値にも露出。
 *
 * 注意: 復興特別所得税（×1.021）はふるさと納税公式側で別途適用するため、ここでは
 *       純粋なブラケット税率（5/10/20/23/33/40/45%）のみを返す。
 *
 * @param taxableIncome - 課税所得（円）
 * @returns 0〜0.45 の税率
 */
export function calcMarginalIncomeTaxRate(
  taxableIncome: number,
  cfg = config
): number {
  if (taxableIncome <= 0) return 0;
  for (const bracket of cfg.incomeTax.brackets) {
    if (bracket.to !== null && taxableIncome > bracket.to) continue;
    return bracket.rate;
  }
  // 全ブラケット to !== null なら最後のブラケットの税率
  return cfg.incomeTax.brackets[cfg.incomeTax.brackets.length - 1]?.rate ?? 0;
}

/**
 * 住民税額を計算（所得割 + 均等割）
 */
export function calcResidentTax(
  totalIncome: number,
  socialInsuranceDeduction: number,
  cfg = config
): number {
  const basicDeduction = calcResidentBasicDeduction(totalIncome, cfg);
  const taxableIncome = Math.max(
    0,
    Math.floor(totalIncome - basicDeduction - socialInsuranceDeduction)
  );
  const incomeComponent = Math.floor(taxableIncome * cfg.residentTax.incomeRate);
  const perCapita =
    cfg.residentTax.perCapita + cfg.residentTax.forestEnvironmentTax;
  return incomeComponent + perCapita;
}

/**
 * 退職所得控除を計算
 */
export function calcRetirementIncomeDeduction(
  yearsOfService: number,
  cfg = config
): number {
  const r = cfg.incomeTax.retirementIncomeDeduction;
  if (yearsOfService <= r.yearsThreshold) {
    return Math.max(r.minimumDeduction, yearsOfService * r.belowThresholdPerYear);
  }
  return (
    r.yearsThreshold * r.belowThresholdPerYear +
    (yearsOfService - r.yearsThreshold) * r.aboveThresholdPerYear
  );
}

/**
 * 退職所得（iDeCo一括受取時）
 */
export function calcRetirementTaxableIncome(
  lumpSum: number,
  yearsOfService: number,
  cfg = config
): number {
  const deduction = calcRetirementIncomeDeduction(yearsOfService, cfg);
  const r = cfg.incomeTax.retirementIncomeDeduction;
  return Math.max(0, Math.floor((lumpSum - deduction) * r.taxableRatio));
}

/**
 * 特定口座の譲渡益に対する税額
 */
export function calcTokuteiTax(gain: number, cfg = config): number {
  if (gain <= 0) return 0;
  return Math.floor(gain * cfg.investmentTax.tokuteiRate);
}

/**
 * NISA口座の譲渡益に対する税額（常に0）
 */
export function calcNisaTax(_gain: number): number {
  return 0;
}

export interface AnnualTaxResult {
  employmentIncome: number;
  socialInsurance: number;
  incomeTax: number;
  residentTax: number;
  totalTax: number;
  netIncome: number;
  /** 課税所得（v4.6.1 T-7 ふるさと納税 上限算定で参照） */
  taxableIncome: number;
  /** 限界所得税率（v4.6.1 T-7） */
  marginalIncomeTaxRate: number;
}

/**
 * 給与収入に対する年間の税金・社保・手取りを一括計算
 */
export function calcAnnualTax(
  salary: number,
  age: number,
  cfg = config
): AnnualTaxResult {
  const employmentIncome = calcEmploymentIncome(salary, cfg);
  const socialInsurance = calcSocialInsurancePremium(employmentIncome, age, cfg);
  const taxableIncome = calcTaxableIncome(employmentIncome, socialInsurance, cfg);
  const incomeTax = calcIncomeTax(taxableIncome, cfg);
  const residentTax = calcResidentTax(employmentIncome, socialInsurance, cfg);
  const totalTax = incomeTax + residentTax + socialInsurance;
  const netIncome = salary - totalTax;
  const marginalIncomeTaxRate = calcMarginalIncomeTaxRate(taxableIncome, cfg);

  return {
    employmentIncome,
    socialInsurance,
    incomeTax,
    residentTax,
    totalTax,
    netIncome,
    taxableIncome,
    marginalIncomeTaxRate,
  };
}

/**
 * ふるさと納税の年間自己負担2,000円で済む寄附上限額。
 *
 * v4.6.1 (T-7): 総務省「ふるさと納税ポータル」の標準計算式に準拠。
 *
 *   limit = (taxableIncome × 0.10 × 0.20) / (1 − marginalRate × 1.021 − 0.10) + 2000
 *
 * - 0.10 = 住民税所得割の標準税率
 * - 0.20 = 特例控除部分の上限割合
 * - 1.021 = 復興特別所得税の係数
 *
 * 課税所得 0 円のユーザーは 2,000 円（自己負担分のみ）を返す。
 *
 * @param taxableIncome - 課税所得（円、`calcAnnualTax().taxableIncome` を渡す）
 * @param marginalIncomeTaxRate - 限界所得税率（0〜0.45、`calcAnnualTax().marginalIncomeTaxRate`）
 * @returns 上限額（円、整数）
 */
export function calcFurusatoLimit(
  taxableIncome: number,
  marginalIncomeTaxRate: number,
): number {
  const FLAT_FEE = 2000;
  if (taxableIncome <= 0) return FLAT_FEE;
  // 高所得側で分母が 0 や負になることはない（最大 marginalRate=0.45 なら 0.5405、最低 0.05 なら 0.7990）
  const denominator = 1 - marginalIncomeTaxRate * 1.021 - 0.10;
  if (denominator <= 0) return FLAT_FEE; // 安全弁
  const numerator = taxableIncome * 0.10 * 0.20;
  return Math.floor(numerator / denominator) + FLAT_FEE;
}

/** 金現物: 50万円特別控除（所得税法33条3項2号） */
const GOLD_SPECIAL_DEDUCTION = 500_000;
/** 金現物: 長期譲渡所得 1/2課税（所得税法22条2項2号） */
const GOLD_LONG_TERM_RATIO = 0.5;

/**
 * 金現物の総合課税対象所得を計算（50万円特別控除 + 1/2課税）
 */
export function calcGoldTaxableIncome(gain: number): number {
  const afterDeduction = Math.max(0, gain - GOLD_SPECIAL_DEDUCTION);
  return afterDeduction * GOLD_LONG_TERM_RATIO;
}

/**
 * 金現物（長期譲渡所得）の税額を計算
 * 5年超の長期保有前提: 50万円特別控除 + 1/2課税 → 総合課税
 *
 * otherIncome: 退職後は給与所得0、特定口座は源泉分離、iDeCoは退職所得（分離）のため、
 * 金の前に総合課税所得が発生するケースは現モデルにない。デフォルト0。
 */
export function calcGoldWithdrawalTax(
  withdrawalAmount: number,
  gainRatio: number,
  otherIncome: number,
  cfg = config
): { tax: number; taxableIncome: number } {
  const gain = withdrawalAmount * gainRatio;
  const taxableIncome = calcGoldTaxableIncome(gain);

  if (taxableIncome <= 0) {
    return { tax: 0, taxableIncome: 0 };
  }

  // 総合課税: 他の所得と合算して累進課税の差分で計算
  const totalIncome = otherIncome + taxableIncome;
  const taxWithGold = calcIncomeTax(
    calcTaxableIncome(totalIncome, 0, cfg),
    cfg
  );
  const taxWithoutGold = otherIncome > 0
    ? calcIncomeTax(calcTaxableIncome(otherIncome, 0, cfg), cfg)
    : 0;
  const incomeTaxDiff = taxWithGold - taxWithoutGold;

  // 住民税（所得割のみ、差分）— 基礎控除を適用
  const residentTaxableWithGold = Math.max(0, totalIncome - calcResidentBasicDeduction(totalIncome, cfg));
  const residentTaxableWithoutGold = otherIncome > 0
    ? Math.max(0, otherIncome - calcResidentBasicDeduction(otherIncome, cfg))
    : 0;
  const residentWithGold = Math.floor(residentTaxableWithGold * cfg.residentTax.incomeRate);
  const residentWithoutGold = Math.floor(residentTaxableWithoutGold * cfg.residentTax.incomeRate);
  const residentTaxDiff = residentWithGold - residentWithoutGold;

  const tax = Math.max(0, incomeTaxDiff + residentTaxDiff);
  return { tax, taxableIncome };
}

/* ---------- v0.9: 公的年金等控除・年金課税・副収入課税 ---------- */

/**
 * 公的年金等控除を計算
 * 他の所得が1,000万円以下の場合（FIRE後の典型ケース）
 */
export function calcPublicPensionDeduction(
  pensionIncome: number,
  age: number,
  cfg = config
): number {
  const brackets = age >= 65
    ? cfg.publicPensionDeduction.age65plus
    : cfg.publicPensionDeduction.under65;

  for (const b of brackets) {
    if (b.maxIncome === null || pensionIncome <= b.maxIncome) {
      if (b.deduction !== undefined) return b.deduction;
      return Math.floor(pensionIncome * b.rate! + b.base!);
    }
  }
  return 0;
}

/**
 * 退職金の手取りを計算
 * 退職所得控除適用後の税額を差し引く
 */
export function calcRetirementBonusNet(
  amount: number,
  yearsOfService: number,
  cfg = config
): { net: number; tax: number } {
  if (amount <= 0) return { net: 0, tax: 0 };
  const taxableIncome = calcRetirementTaxableIncome(amount, yearsOfService, cfg);
  const incomeTax = calcIncomeTax(taxableIncome, cfg);
  // 退職所得は分離課税: 住民税10%
  const residentTax = Math.floor(taxableIncome * cfg.residentTax.incomeRate);
  const tax = incomeTax + residentTax;
  return { net: amount - tax, tax };
}

/* ---------- v4.6.3 (T-2): iDeCo × 退職金 5/19 年ルール ---------- */

/**
 * 退職所得の重複勤務期間ルール（所得税法施行令70条 + 基本通達30-12）に基づき、
 * 後発側の退職一時金（iDeCo一時金 or 退職金）の控除年数から重複期間を差し引いた
 * 「実効勤続年数」を返す。
 *
 * v4.6.3 (T-2 年単位近似版): autoplan Premise Gate P-3 で合意。
 *
 * **精度の限界 (gstack-review v4.6.5 補足)**:
 * 本実装は「年単位の近似」であり、月単位の通達精度には到達していない。
 * 通達 30-12 は「重複した勤務期間の月数」で計算するが、ここでは
 * `overlap = min(firstYears, secondYears) - gap` の整数年計算で代替する。
 * 月単位の端数や暦年開始日のズレが税額に影響するケース（特に境界年）では
 * 数千円〜数万円の誤差が出る可能性がある。**正確な税額は税理士に確認のこと**。
 *
 * ルール（2026年現在の解釈）:
 * - 退職金（先）→ iDeCo一時金（後）: 受給年差が **19年** 以内なら、iDeCo側の加入年数控除から
 *   重複期間（min(退職勤続, iDeCo加入) - gap）を差し引く（gap が 19以上ならフル控除）
 * - iDeCo一時金（先）→ 退職金（後）: 受給年差が **5年** 以内なら、退職金側の勤続年数控除から
 *   同様の重複期間を差し引く（gap が 5以上ならフル控除）
 *
 * 控除年数が 0 を割る場合は `Math.max(0, ...)` でガード（80万円下限保証は
 * `calcRetirementIncomeDeduction` 内で適用される）。
 *
 * @param firstAge - 先発側の受給年齢
 * @param firstYears - 先発側の勤続/加入年数
 * @param secondAge - 後発側の受給年齢
 * @param secondYears - 後発側の勤続/加入年数
 * @param ruleYears - 適用ルール（先発が iDeCo なら 5、退職金なら 19）
 * @returns 後発側の実効年数（0 以上の整数）
 */
export function calcEffectiveYearsForLumpSum(
  firstAge: number,
  firstYears: number,
  secondAge: number,
  secondYears: number,
  ruleYears: 5 | 19,
): number {
  if (firstYears < 0 || secondYears < 0) return Math.max(0, secondYears);
  const gap = secondAge - firstAge;
  if (gap < 0) {
    // 順序が逆: 引数の使い方が間違い → 安全側で何も差し引かずそのまま返す
    return secondYears;
  }
  if (gap >= ruleYears) {
    // フル控除（重複期間なし）
    return secondYears;
  }
  // 重複期間 = min(両者の年数) - gap
  const overlap = Math.max(0, Math.min(firstYears, secondYears) - gap);
  return Math.max(0, secondYears - overlap);
}

/**
 * iDeCo 一時金 + 退職金の合計手取り（5/19 年ルール適用）。
 *
 * - `idecoFirst=true` のとき: iDeCo 先、退職金後 → 退職金側の控除を 5 年ルールで圧縮
 * - `idecoFirst=false` のとき: 退職金先、iDeCo 後 → iDeCo 側の控除を 19 年ルールで圧縮
 *
 * @param ideco - iDeCo 一時金（金額・受給年齢・加入年数）
 * @param bonus - 退職金（金額・受給年齢・勤続年数）
 * @returns `{ idecoNet, idecoTax, bonusNet, bonusTax, totalNet, totalTax }`
 */
export function calcCombinedLumpSumNet(
  ideco: { amount: number; receiveAge: number; yearsOfContribution: number },
  bonus: { amount: number; receiveAge: number; yearsOfService: number },
  cfg = config,
): {
  idecoNet: number;
  idecoTax: number;
  bonusNet: number;
  bonusTax: number;
  totalNet: number;
  totalTax: number;
} {
  const idecoFirst = ideco.receiveAge <= bonus.receiveAge;

  // 先発側はフル控除
  const idecoYears = idecoFirst
    ? ideco.yearsOfContribution
    : calcEffectiveYearsForLumpSum(
        bonus.receiveAge,
        bonus.yearsOfService,
        ideco.receiveAge,
        ideco.yearsOfContribution,
        19,
      );
  const bonusYears = idecoFirst
    ? calcEffectiveYearsForLumpSum(
        ideco.receiveAge,
        ideco.yearsOfContribution,
        bonus.receiveAge,
        bonus.yearsOfService,
        5,
      )
    : bonus.yearsOfService;

  const idecoResult = calcRetirementBonusNet(ideco.amount, idecoYears, cfg);
  const bonusResult = calcRetirementBonusNet(bonus.amount, bonusYears, cfg);
  return {
    idecoNet: idecoResult.net,
    idecoTax: idecoResult.tax,
    bonusNet: bonusResult.net,
    bonusTax: bonusResult.tax,
    totalNet: idecoResult.net + bonusResult.net,
    totalTax: idecoResult.tax + bonusResult.tax,
  };
}

/**
 * iDeCo 受給年齢を変動させて、退職金とのペアリングで合計手取り最大となる
 * 受給年齢を求める（処方箋カードの 1 軸として利用）。
 *
 * v4.6.3 (T-2): 60〜75 歳の離散探索。autoplan AD-14 の二層探索（外: idecoTiming、
 * 内: 既存4軸）は v4.6.4 以降の課題として保留。本ヘルパーは「シミュレーション資産推移」
 * を変えず、退職金 × iDeCo 一時金の純粋な税最適化のみを返す。
 *
 * @param ideco - iDeCo 一時金（金額・加入年数）。`receiveAge` は探索で動かすので不要
 * @param bonus - 退職金（金額・受給年齢・勤続年数）
 * @param searchRange - 探索範囲（既定 60〜75 歳）
 * @returns 最適 receiveAge とその時の手取り、現状（=bonus.receiveAge と同じ）との差
 */
export function findOptimalIdecoLumpSumAge(
  ideco: { amount: number; yearsOfContribution: number; currentReceiveAge: number },
  bonus: { amount: number; receiveAge: number; yearsOfService: number },
  searchRange: { from: number; to: number } = { from: 60, to: 75 },
  cfg = config,
): {
  optimalAge: number;
  optimalNet: number;
  currentNet: number;
  improvement: number;
  byAge: { age: number; net: number; tax: number }[];
} {
  const byAge: { age: number; net: number; tax: number }[] = [];
  let bestAge = ideco.currentReceiveAge;
  let bestNet = -Infinity;

  for (let age = searchRange.from; age <= searchRange.to; age++) {
    const r = calcCombinedLumpSumNet(
      { amount: ideco.amount, receiveAge: age, yearsOfContribution: ideco.yearsOfContribution },
      bonus,
      cfg,
    );
    byAge.push({ age, net: r.totalNet, tax: r.totalTax });
    if (r.totalNet > bestNet) {
      bestNet = r.totalNet;
      bestAge = age;
    }
  }

  const currentResult = calcCombinedLumpSumNet(
    { amount: ideco.amount, receiveAge: ideco.currentReceiveAge, yearsOfContribution: ideco.yearsOfContribution },
    bonus,
    cfg,
  );

  return {
    optimalAge: bestAge,
    optimalNet: bestNet,
    currentNet: currentResult.totalNet,
    improvement: bestNet - currentResult.totalNet,
    byAge,
  };
}

/**
 * 総合課税所得（年金雑所得 + 副収入）に対する所得税+住民税を一括計算
 * 基礎控除は1回のみ適用
 *
 * @param pensionTaxable 公的年金等控除後の雑所得
 * @param sideIncome 副収入（事業/雑所得）
 * @param socialInsuranceDeduction 社会保険料控除
 */
export function calcComprehensiveTax(
  pensionTaxable: number,
  sideIncome: number,
  socialInsuranceDeduction: number,
  cfg = config
): { incomeTax: number; residentTax: number; total: number } {
  const totalIncome = pensionTaxable + sideIncome;
  if (totalIncome <= 0) return { incomeTax: 0, residentTax: 0, total: 0 };

  const taxableIncome = calcTaxableIncome(totalIncome, socialInsuranceDeduction, cfg);
  const incomeTax = calcIncomeTax(taxableIncome, cfg);
  const residentTax = calcResidentTax(totalIncome, socialInsuranceDeduction, cfg);

  return { incomeTax, residentTax, total: incomeTax + residentTax };
}
