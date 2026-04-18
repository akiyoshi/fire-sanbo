import { describe, it, expect } from "vitest";
import { drawFromAccounts, contributeSurplus } from "./helpers";
import type { MemberAccounts } from "./helpers";
import { CostBasis } from "./cost-basis";

function makeAccts(overrides?: Partial<MemberAccounts>): MemberAccounts {
  return {
    nisa: 0, tokutei: 0, ideco: 0, gold: 0, cash: 0,
    nisaCumulative: 0,
    tokuteiCB: new CostBasis(0, 0),
    goldCB: new CostBasis(0, 0),
    ...overrides,
  };
}

describe("drawFromAccounts", () => {
  it("withdrawalOrder順に取り崩す", () => {
    const accts = makeAccts({ nisa: 100, tokutei: 200, cash: 50 });
    const drawn = drawFromAccounts(accts, 250, ["nisa", "tokutei", "ideco", "gold_physical", "cash"], 60);
    expect(drawn).toBe(250);
    expect(accts.nisa).toBe(0);
    expect(accts.tokutei).toBe(50);
  });

  it("deficitより残高が少ない場合は全額取り崩し", () => {
    const accts = makeAccts({ tokutei: 100 });
    const drawn = drawFromAccounts(accts, 500, ["tokutei", "nisa", "ideco", "gold_physical", "cash"], 60);
    expect(drawn).toBe(100);
    expect(accts.tokutei).toBe(0);
  });

  it("iDeCoは60歳未満で取り崩し不可", () => {
    const accts = makeAccts({ ideco: 1000 });
    const drawn = drawFromAccounts(accts, 500, ["ideco", "nisa", "tokutei", "gold_physical", "cash"], 55);
    expect(drawn).toBe(0);
    expect(accts.ideco).toBe(1000);
  });

  it("iDeCoは60歳以上で取り崩し可能", () => {
    const accts = makeAccts({ ideco: 1000 });
    const drawn = drawFromAccounts(accts, 500, ["ideco", "nisa", "tokutei", "gold_physical", "cash"], 60);
    expect(drawn).toBe(500);
    expect(accts.ideco).toBe(500);
  });

  it("tokutei取り崩し時にcostBasisが按分減少", () => {
    const cb = new CostBasis(1000, 0.5); // cost=500
    const accts = makeAccts({ tokutei: 1000, tokuteiCB: cb });
    drawFromAccounts(accts, 500, ["tokutei"], 60);
    expect(accts.tokutei).toBe(500);
    expect(cb.cost).toBeCloseTo(250);
  });

  it("gold取り崩し時にcostBasisが按分減少", () => {
    const cb = new CostBasis(2000, 0.3); // cost=1400
    const accts = makeAccts({ gold: 2000, goldCB: cb });
    drawFromAccounts(accts, 1000, ["gold_physical"], 60);
    expect(accts.gold).toBe(1000);
    expect(cb.cost).toBeCloseTo(700);
  });
});

describe("contributeSurplus", () => {
  it("NISA枠ありならNISA優先→tokutei", () => {
    const accts = makeAccts();
    contributeSurplus(accts, 5_000_000, { annualLimit: 3_600_000, lifetimeLimit: 18_000_000 });
    expect(accts.nisa).toBe(3_600_000);
    expect(accts.nisaCumulative).toBe(3_600_000);
    expect(accts.tokutei).toBe(1_400_000);
  });

  it("NISA生涯枠を超えたらtokuteiのみ", () => {
    const accts = makeAccts({ nisaCumulative: 18_000_000 });
    contributeSurplus(accts, 1_000_000, { annualLimit: 3_600_000, lifetimeLimit: 18_000_000 });
    expect(accts.nisa).toBe(0);
    expect(accts.tokutei).toBe(1_000_000);
  });

  it("NISA設定なしならtokuteiに全額", () => {
    const accts = makeAccts();
    contributeSurplus(accts, 2_000_000);
    expect(accts.nisa).toBe(0);
    expect(accts.tokutei).toBe(2_000_000);
  });

  it("積立時にtokuteiCBのcostが増加", () => {
    const cb = new CostBasis(0, 0);
    const accts = makeAccts({ tokuteiCB: cb });
    contributeSurplus(accts, 1_000_000);
    expect(cb.cost).toBe(1_000_000);
  });
});
