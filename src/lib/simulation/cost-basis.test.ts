import { describe, it, expect } from "vitest";
import { CostBasis } from "./cost-basis";

describe("CostBasis", () => {
  it("初期化: balance=10M, gainRatio=0.5 → cost=5M", () => {
    const cb = new CostBasis(10_000_000, 0.5);
    expect(cb.cost).toBe(5_000_000);
  });

  it("初期化: balance=0 → cost=0", () => {
    const cb = new CostBasis(0, 0.5);
    expect(cb.cost).toBe(0);
  });

  it("gainRatio: balance=10M, cost=5M → 0.5", () => {
    const cb = new CostBasis(10_000_000, 0.5);
    expect(cb.gainRatio(10_000_000)).toBeCloseTo(0.5);
  });

  it("gainRatio: balance=0 → 0 (ゼロ除算防止)", () => {
    const cb = new CostBasis(0, 0.5);
    expect(cb.gainRatio(0)).toBe(0);
  });

  it("gainRatio: 含み損 (balance < cost) → 0", () => {
    const cb = new CostBasis(10_000_000, 0.2); // cost=8M
    // 暴落で balance=5M → cost=8M > balance → gainRatio=0
    expect(cb.gainRatio(5_000_000)).toBe(0);
  });

  it("contribute: 積立でcostが増加しgainRatioが低下", () => {
    const cb = new CostBasis(10_000_000, 0.5); // cost=5M
    cb.contribute(5_000_000); // 5M積立 → cost=10M
    expect(cb.cost).toBe(10_000_000);
    // balance=15M, cost=10M → gainRatio=1/3
    expect(cb.gainRatio(15_000_000)).toBeCloseTo(1 / 3);
  });

  it("withdraw: 半額取り崩しでcostも半減", () => {
    const cb = new CostBasis(10_000_000, 0.5); // cost=5M
    cb.withdraw(5_000_000, 10_000_000); // 半額取り崩し
    expect(cb.cost).toBeCloseTo(2_500_000);
    // gainRatioは維持される: balance=5M, cost=2.5M → 0.5
    expect(cb.gainRatio(5_000_000)).toBeCloseTo(0.5);
  });

  it("withdraw: 全額取り崩しでcost≈0", () => {
    const cb = new CostBasis(10_000_000, 0.5);
    cb.withdraw(10_000_000, 10_000_000);
    expect(cb.cost).toBeCloseTo(0);
  });

  it("withdraw: balance=0 → costは変化しない", () => {
    const cb = new CostBasis(0, 0.5);
    cb.withdraw(0, 0);
    expect(cb.cost).toBe(0);
  });

  it("リターン後: costは不変、gainRatioが上昇", () => {
    const cb = new CostBasis(10_000_000, 0.5); // cost=5M
    // 5%リターン → balance=10.5M, cost=5M → gainRatio≈0.524
    expect(cb.gainRatio(10_500_000)).toBeCloseTo(1 - 5_000_000 / 10_500_000);
  });

  it("積立→リターン→取り崩しサイクルでcostが正しく追跡される", () => {
    const cb = new CostBasis(10_000_000, 0.5); // cost=5M, balance=10M
    let balance = 10_000_000;

    // 積立 5M → cost=10M, balance=15M
    cb.contribute(5_000_000);
    balance += 5_000_000;
    expect(cb.cost).toBe(10_000_000);

    // リターン 10% → cost=10M, balance=16.5M
    balance *= 1.1;
    expect(cb.gainRatio(balance)).toBeCloseTo(1 - 10_000_000 / 16_500_000);

    // 取り崩し 5M → cost按分減少
    cb.withdraw(5_000_000, balance);
    balance -= 5_000_000;
    const expectedCost = 10_000_000 - 5_000_000 * (10_000_000 / 16_500_000);
    expect(cb.cost).toBeCloseTo(expectedCost);
  });

  it("極小残高での取り崩しで負のcostにならない", () => {
    const cb = new CostBasis(100, 0.5); // cost=50, balance=100
    // balance を0.01まで段階的に取り崩し
    let balance = 100;
    for (let i = 0; i < 20; i++) {
      const amount = Math.min(5, balance);
      if (amount <= 0) break;
      cb.withdraw(amount, balance);
      balance -= amount;
    }
    expect(cb.cost).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(cb.cost)).toBe(true);
  });

  it("複数回の小額取り崩しでgainRatioが安定する", () => {
    const cb = new CostBasis(10_000_000, 0.5); // cost=5M
    let balance = 10_000_000;
    const initialGainRatio = cb.gainRatio(balance);

    // 100回の小額取り崩し
    for (let i = 0; i < 100; i++) {
      const amount = 50_000;
      cb.withdraw(amount, balance);
      balance -= amount;
    }
    // 5M取り崩し後: balance=5M
    // gainRatioは理論上変わらない（按分による不変量）
    expect(cb.gainRatio(balance)).toBeCloseTo(initialGainRatio, 5);
  });

  it("costがbalanceを超える下落後の積立で正しく回復する", () => {
    const cb = new CostBasis(10_000_000, 0.2); // cost=8M
    // 下落: balance=5M < cost=8M
    expect(cb.gainRatio(5_000_000)).toBe(0); // 含み損

    // 追加積立 10M → cost=18M, balance=15M
    cb.contribute(10_000_000);
    expect(cb.cost).toBe(18_000_000);
    expect(cb.gainRatio(15_000_000)).toBe(0); // まだ含み損

    // リターンで回復: balance=20M
    expect(cb.gainRatio(20_000_000)).toBeCloseTo(0.1); // 1 - 18M/20M = 0.1
  });
});
