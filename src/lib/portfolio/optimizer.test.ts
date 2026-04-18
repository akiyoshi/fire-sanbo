import { describe, it, expect } from "vitest";
import { optimizePortfolio, selectByMode } from "./optimizer";
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

describe("selectByMode", () => {
  const full: AssetClassId[] = [
    "domestic_stock", "developed_stock", "emerging_stock",
    "domestic_bond", "developed_bond", "emerging_bond",
    "domestic_reit", "developed_reit", "gold",
  ];

  it("reduce-risk: 同リターンでリスクが下がる", () => {
    const result = optimizePortfolio(full, 0.5);
    // フロンティアの中間点より高リスクな現在ポートフォリオを想定
    const mid = result.frontier[Math.floor(result.frontier.length / 2)];
    const highRisk = mid.risk * 1.5;
    const optimal = selectByMode(result.frontier, mid.expectedReturn, highRisk, "reduce-risk");
    expect(optimal).not.toBeNull();
    expect(optimal!.risk).toBeLessThan(highRisk);
    expect(optimal!.expectedReturn).toBeGreaterThanOrEqual(mid.expectedReturn - 0.001);
  });

  it("increase-return: 同リスクでリターンが上がる", () => {
    const result = optimizePortfolio(full, 0.5);
    // フロンティアの中間点より低リターンな現在ポートフォリオを想定
    const mid = result.frontier[Math.floor(result.frontier.length / 2)];
    const lowReturn = mid.expectedReturn * 0.5;
    const optimal = selectByMode(result.frontier, lowReturn, mid.risk, "increase-return");
    expect(optimal).not.toBeNull();
    expect(optimal!.expectedReturn).toBeGreaterThan(lowReturn);
    expect(optimal!.risk).toBeLessThanOrEqual(mid.risk + 0.001);
  });

  it("reduce-risk: 既にフロンティア上なら改善なし（null）", () => {
    const result = optimizePortfolio(full, 0.5);
    const onFrontier = result.frontier[Math.floor(result.frontier.length / 2)];
    const optimal = selectByMode(result.frontier, onFrontier.expectedReturn, onFrontier.risk, "reduce-risk");
    expect(optimal).toBeNull();
  });

  it("increase-return: 既にフロンティア上なら改善なし（null）", () => {
    const result = optimizePortfolio(full, 0.5);
    const onFrontier = result.frontier[Math.floor(result.frontier.length / 2)];
    const optimal = selectByMode(result.frontier, onFrontier.expectedReturn, onFrontier.risk, "increase-return");
    expect(optimal).toBeNull();
  });

  it("空のフロンティアではnullを返す", () => {
    expect(selectByMode([], 0.05, 0.15, "reduce-risk")).toBeNull();
    expect(selectByMode([], 0.05, 0.15, "increase-return")).toBeNull();
  });
});
