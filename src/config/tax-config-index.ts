import type { TaxConfig } from "@/lib/tax/types";
import cfg2026 from "./tax-config-2026.json";

const configs: Record<number, TaxConfig> = {
  2026: cfg2026 as TaxConfig,
};

export const LATEST_YEAR = 2026;

export function getTaxConfig(year?: number): TaxConfig {
  const y = year ?? LATEST_YEAR;
  return configs[y] ?? configs[LATEST_YEAR];
}
