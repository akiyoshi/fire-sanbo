export const ASSET_CLASS_IDS = [
  "domestic_stock",
  "developed_stock",
  "emerging_stock",
  "domestic_bond",
  "developed_bond",
  "emerging_bond",
  "domestic_reit",
  "developed_reit",
  "cash",
] as const;

export type AssetClassId = (typeof ASSET_CLASS_IDS)[number];

export interface AssetClassData {
  label: string;
  expectedReturn: number;
  risk: number;
}

export interface PortfolioEntry {
  assetClass: AssetClassId;
  amount: number;
}

export interface PortfolioResult {
  expectedReturn: number;
  risk: number;
  weights: Record<AssetClassId, number>;
  totalAmount: number;
}
