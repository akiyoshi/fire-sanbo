import { describe, it, expect } from "vitest";
import { withdrawFromMember } from "./member-withdrawal";
import type { MemberAccounts } from "./helpers";
import { CostBasis } from "./cost-basis";
import type { TaxCategory } from "@/lib/tax";

function makeAccounts(overrides: Partial<Record<"nisa" | "tokutei" | "ideco" | "gold" | "cash", number>> = {}): MemberAccounts {
  return {
    nisa: overrides.nisa ?? 0,
    tokutei: overrides.tokutei ?? 0,
    ideco: overrides.ideco ?? 0,
    gold: overrides.gold ?? 0,
    cash: overrides.cash ?? 1_000_000,
    nisaCumulative: overrides.nisa ?? 0,
    tokuteiCB: new CostBasis(overrides.tokutei ?? 0, 0.5),
    goldCB: new CostBasis(overrides.gold ?? 0, 0.3),
  };
}

const DEFAULT_ORDER: TaxCategory[] = ["cash", "nisa", "tokutei", "gold_physical", "ideco"];

describe("withdrawFromMember", () => {
  it("cashのみ取り崩し: 税ゼロ", () => {
    const accts = makeAccounts({ cash: 3_000_000 });
    const result = withdrawFromMember(accts, 1_000_000, DEFAULT_ORDER, 65, {
      yearsOfService: 20,
      comprehensiveIncome: 0,
    });
    expect(result.drawn).toBe(1_000_000);
    expect(result.taxTotal).toBe(0);
    expect(accts.cash).toBe(2_000_000);
  });

  it("NISA → tokutei順: NISAは非課税、tokuteiは課税", () => {
    const order: TaxCategory[] = ["nisa", "tokutei", "cash", "gold_physical", "ideco"];
    const accts = makeAccounts({ nisa: 500_000, tokutei: 2_000_000 });
    const result = withdrawFromMember(accts, 1_000_000, order, 65, {
      yearsOfService: 20,
      comprehensiveIncome: 0,
    });
    // NISAから50万引き出し（非課税、net = 50万）
    // 残りdeficit: 100万 - 50万(net) = 50万
    // tokuteiから50万引き出し → 税あり
    expect(accts.nisa).toBe(0);
    expect(result.drawn).toBeGreaterThan(500_000); // NISA 50万 + tokutei分
    expect(result.taxTotal).toBeGreaterThan(0); // tokuteiで課税発生
  });

  it("iDeCo 60歳未満はスキップ", () => {
    const order: TaxCategory[] = ["ideco", "cash", "nisa", "tokutei", "gold_physical"];
    const accts = makeAccounts({ ideco: 5_000_000, cash: 1_000_000 });
    const result = withdrawFromMember(accts, 500_000, order, 55, {
      yearsOfService: 20,
      comprehensiveIncome: 0,
    });
    // iDeCoはスキップされ、cashから取り崩し
    expect(accts.ideco).toBe(5_000_000); // 変化なし
    expect(accts.cash).toBe(500_000);
    expect(result.drawn).toBe(500_000);
  });

  it("iDeCo 60歳以上は取り崩し可能", () => {
    const order: TaxCategory[] = ["ideco", "cash", "nisa", "tokutei", "gold_physical"];
    const accts = makeAccounts({ ideco: 5_000_000 });
    const result = withdrawFromMember(accts, 500_000, order, 60, {
      yearsOfService: 20,
      comprehensiveIncome: 0,
    });
    expect(accts.ideco).toBeLessThan(5_000_000);
    expect(result.drawn).toBe(500_000);
  });

  it("tokutei取り崩しでCostBasis按分減少", () => {
    const accts = makeAccounts({ tokutei: 2_000_000 });
    // gainRatio = 0.5 → 含み益50%
    const cbBefore = accts.tokuteiCB.gainRatio(accts.tokutei);
    expect(cbBefore).toBeCloseTo(0.5);

    const order: TaxCategory[] = ["tokutei", "cash", "nisa", "gold_physical", "ideco"];
    withdrawFromMember(accts, 500_000, order, 65, {
      yearsOfService: 20,
      comprehensiveIncome: 0,
    });
    // 按分減少: costBasis = 1M * (1.5M / 2M) = 750K
    // gainRatio(1.5M) = 1 - 750K / 1.5M = 0.5 (不変)
    expect(accts.tokuteiCB.gainRatio(accts.tokutei)).toBeCloseTo(0.5, 1);
    expect(accts.tokutei).toBe(1_500_000);
  });

  it("gold取り崩しでcomprehensiveIncome累積", () => {
    const accts = makeAccounts({ gold: 3_000_000 });
    const order: TaxCategory[] = ["gold_physical", "cash", "nisa", "tokutei", "ideco"];
    const result = withdrawFromMember(accts, 1_000_000, order, 65, {
      yearsOfService: 20,
      comprehensiveIncome: 0,
    });
    // gold gainRatio=0.3 → gain = 1M * 0.3 = 300K
    // taxableIncome = max(0, 300K - 500K) * 0.5 = 0（特別控除内）
    // comprehensiveIncome = 0 + 0 = 0（控除内なので0）
    expect(result.comprehensiveIncome).toBe(0);
    expect(result.taxTotal).toBe(0); // 控除内で税ゼロ
  });

  it("gold大口取り崩しでcomprehensiveIncomeが増加", () => {
    const accts = makeAccounts({ gold: 10_000_000 });
    // costBasis作り直し: gainRatio=0.5 → 含み益50%
    accts.goldCB = new CostBasis(10_000_000, 0.5);
    const order: TaxCategory[] = ["gold_physical", "cash", "nisa", "tokutei", "ideco"];
    const result = withdrawFromMember(accts, 5_000_000, order, 65, {
      yearsOfService: 20,
      comprehensiveIncome: 0,
    });
    // gain = 5M * 0.5 = 2.5M
    // afterDeduction = max(0, 2.5M - 500K) = 2M
    // taxableIncome = 2M * 0.5 = 1M
    expect(result.comprehensiveIncome).toBe(1_000_000);
    expect(result.taxTotal).toBeGreaterThan(0);
  });

  it("deficit > 全口座残高 → 全額引き出し", () => {
    const accts = makeAccounts({ cash: 500_000, nisa: 300_000 });
    const result = withdrawFromMember(accts, 2_000_000, DEFAULT_ORDER, 65, {
      yearsOfService: 20,
      comprehensiveIncome: 0,
    });
    expect(accts.cash).toBe(0);
    expect(accts.nisa).toBe(0);
    expect(result.drawn).toBe(800_000); // 50万 + 30万
  });

  it("deficit = 0 → 何も引き出さない", () => {
    const accts = makeAccounts({ cash: 1_000_000 });
    const result = withdrawFromMember(accts, 0, DEFAULT_ORDER, 65, {
      yearsOfService: 20,
      comprehensiveIncome: 0,
    });
    expect(result.drawn).toBe(0);
    expect(result.taxTotal).toBe(0);
    expect(accts.cash).toBe(1_000_000);
  });
});
