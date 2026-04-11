import { describe, it, expect } from "vitest";
import { calcPortfolio } from "./engine";
import type { PortfolioEntry } from "./types";

describe("calcPortfolio", () => {
  it("単一資産100% → その資産のリターン・リスクがそのまま返る", () => {
    const entries: PortfolioEntry[] = [
      { assetClass: "developed_stock", amount: 10_000_000 },
    ];
    const result = calcPortfolio(entries);
    expect(result.expectedReturn).toBeCloseTo(0.09, 4);
    expect(result.risk).toBeCloseTo(0.195, 4);
    expect(result.totalAmount).toBe(10_000_000);
    expect(result.weights.developed_stock).toBeCloseTo(1.0);
  });

  it("現金100% → リターン0%、リスク0%", () => {
    const entries: PortfolioEntry[] = [
      { assetClass: "cash", amount: 5_000_000 },
    ];
    const result = calcPortfolio(entries);
    expect(result.expectedReturn).toBe(0);
    expect(result.risk).toBe(0);
  });

  it("空のポートフォリオ → ゼロ", () => {
    const result = calcPortfolio([]);
    expect(result.expectedReturn).toBe(0);
    expect(result.risk).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it("保有額0の行は無視される", () => {
    const entries: PortfolioEntry[] = [
      { assetClass: "domestic_stock", amount: 0 },
      { assetClass: "developed_stock", amount: 10_000_000 },
    ];
    const result = calcPortfolio(entries);
    expect(result.expectedReturn).toBeCloseTo(0.09, 4);
    expect(result.weights.domestic_stock).toBe(0);
  });

  it("2資産50/50で分散効果によりリスクが加重平均未満", () => {
    // 国内株式(リスク18%) + 国内債券(リスク2.5%)、相関 -0.10
    const entries: PortfolioEntry[] = [
      { assetClass: "domestic_stock", amount: 5_000_000 },
      { assetClass: "domestic_bond", amount: 5_000_000 },
    ];
    const result = calcPortfolio(entries);
    // 加重平均リスク = 0.5*18 + 0.5*2.5 = 10.25%
    const simpleAvgRisk = 0.5 * 0.18 + 0.5 * 0.025;
    expect(result.risk).toBeLessThan(simpleAvgRisk);
    // 分散効果があるので相当低い
    expect(result.risk).toBeGreaterThan(0);
  });

  it("合成リターンは加重平均と一致", () => {
    const entries: PortfolioEntry[] = [
      { assetClass: "domestic_stock", amount: 3_000_000 },
      { assetClass: "developed_stock", amount: 7_000_000 },
    ];
    const result = calcPortfolio(entries);
    const expectedWeightedReturn = 0.3 * 0.08 + 0.7 * 0.09;
    expect(result.expectedReturn).toBeCloseTo(expectedWeightedReturn, 6);
  });

  it("GPIF基本ポートフォリオ(25%×4)で妥当な合成値", () => {
    // 国内株式25% + 先進国株式25% + 国内債券25% + 先進国債券25%
    const entries: PortfolioEntry[] = [
      { assetClass: "domestic_stock", amount: 25_000_000 },
      { assetClass: "developed_stock", amount: 25_000_000 },
      { assetClass: "domestic_bond", amount: 25_000_000 },
      { assetClass: "developed_bond", amount: 25_000_000 },
    ];
    const result = calcPortfolio(entries);
    // 合成リターン = 0.25*(8+9+1+3.5)% = 5.375%
    expect(result.expectedReturn).toBeCloseTo(0.05375, 4);
    // 合成リスク: 分散効果でかなり低くなるが3%〜12%の範囲
    expect(result.risk).toBeGreaterThan(0.03);
    expect(result.risk).toBeLessThan(0.12);
  });

  it("ウェイトの合計が1になる", () => {
    const entries: PortfolioEntry[] = [
      { assetClass: "domestic_stock", amount: 3_000_000 },
      { assetClass: "developed_stock", amount: 5_000_000 },
      { assetClass: "domestic_bond", amount: 2_000_000 },
    ];
    const result = calcPortfolio(entries);
    const totalWeight = Object.values(result.weights).reduce((s, w) => s + w, 0);
    expect(totalWeight).toBeCloseTo(1.0, 10);
  });

  it("同じ資産クラスの複数行が合算される", () => {
    const entries: PortfolioEntry[] = [
      { assetClass: "developed_stock", amount: 3_000_000 },
      { assetClass: "developed_stock", amount: 7_000_000 },
    ];
    const result = calcPortfolio(entries);
    expect(result.expectedReturn).toBeCloseTo(0.09, 4);
    expect(result.risk).toBeCloseTo(0.195, 4);
    expect(result.totalAmount).toBe(10_000_000);
  });
});
