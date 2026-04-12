import { describe, it, expect } from "vitest";
import { optimizePortfolio } from "./optimizer";
import type { AssetClassId } from "./types";

describe("optimizePortfolio", () => {
  const stockBond: AssetClassId[] = ["domestic_stock", "domestic_bond"];
  const full: AssetClassId[] = [
    "domestic_stock", "developed_stock", "emerging_stock",
    "domestic_bond", "developed_bond", "emerging_bond",
    "domestic_reit", "developed_reit", "gold",
  ];

  it("returns frontier with multiple points", () => {
    const result = optimizePortfolio(full, 0.5);
    expect(result.frontier.length).toBeGreaterThan(2);
  });

  it("frontier is ordered by risk ascending", () => {
    const result = optimizePortfolio(full, 0.5);
    for (let i = 1; i < result.frontier.length; i++) {
      expect(result.frontier[i].risk).toBeGreaterThanOrEqual(result.frontier[i - 1].risk);
    }
  });

  it("frontier points have increasing return", () => {
    const result = optimizePortfolio(full, 0.5);
    for (let i = 1; i < result.frontier.length; i++) {
      expect(result.frontier[i].expectedReturn).toBeGreaterThanOrEqual(
        result.frontier[i - 1].expectedReturn,
      );
    }
  });

  it("weights sum to 1 for each frontier point", () => {
    const result = optimizePortfolio(stockBond, 0.5);
    for (const p of result.frontier) {
      const sum = Object.values(p.weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it("minRisk has lowest risk on frontier", () => {
    const result = optimizePortfolio(full, 0.5);
    for (const p of result.frontier) {
      expect(p.risk).toBeGreaterThanOrEqual(result.minRisk.risk - 1e-10);
    }
  });

  it("maxReturn has highest return on frontier", () => {
    const result = optimizePortfolio(full, 0.5);
    for (const p of result.frontier) {
      expect(p.expectedReturn).toBeLessThanOrEqual(result.maxReturn.expectedReturn + 1e-10);
    }
  });

  it("riskTolerance 0 returns minRisk portfolio", () => {
    const result = optimizePortfolio(full, 0);
    expect(result.recommended.risk).toBe(result.minRisk.risk);
  });

  it("riskTolerance 1 returns maxReturn portfolio", () => {
    const result = optimizePortfolio(full, 1);
    expect(result.recommended.risk).toBe(result.maxReturn.risk);
  });

  it("2 assets: minRisk has higher bond weight", () => {
    const result = optimizePortfolio(stockBond, 0);
    expect(result.minRisk.weights.domestic_bond).toBeGreaterThan(
      result.minRisk.weights.domestic_stock,
    );
  });

  it("2 assets: maxReturn favors stock", () => {
    const result = optimizePortfolio(stockBond, 1);
    expect(result.maxReturn.weights.domestic_stock).toBeGreaterThan(0.9);
  });

  it("empty assets returns zero portfolio", () => {
    const result = optimizePortfolio([], 0.5);
    expect(result.frontier).toHaveLength(1);
    expect(result.recommended.expectedReturn).toBe(0);
    expect(result.recommended.risk).toBe(0);
  });

  it("cash-only assets returns zero portfolio", () => {
    const result = optimizePortfolio(["cash"], 0.5);
    expect(result.frontier).toHaveLength(1);
    expect(result.recommended.expectedReturn).toBe(0);
  });

  it("same seed produces identical results", () => {
    const a = optimizePortfolio(full, 0.5, 5000, 123);
    const b = optimizePortfolio(full, 0.5, 5000, 123);
    expect(a.recommended.expectedReturn).toBe(b.recommended.expectedReturn);
    expect(a.recommended.risk).toBe(b.recommended.risk);
  });
});
