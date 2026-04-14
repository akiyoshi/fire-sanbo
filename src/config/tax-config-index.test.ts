import { describe, it, expect } from "vitest";
import { getTaxConfig, LATEST_YEAR } from "@/config/tax-config-index";

describe("税制年度切替", () => {
  it("getTaxConfig(2026) が 2026年度設定を返す", () => {
    const cfg = getTaxConfig(2026);
    expect(cfg.fiscalYear).toBe(2026);
  });

  it("getTaxConfig() がデフォルト(LATEST_YEAR)を返す", () => {
    const cfg = getTaxConfig();
    expect(cfg.fiscalYear).toBe(LATEST_YEAR);
  });

  it("getTaxConfig(9999) がフォールバック(LATEST_YEAR)を返す", () => {
    const cfg = getTaxConfig(9999);
    expect(cfg.fiscalYear).toBe(LATEST_YEAR);
  });

  it("LATEST_YEAR が 2026 である", () => {
    expect(LATEST_YEAR).toBe(2026);
  });
});
