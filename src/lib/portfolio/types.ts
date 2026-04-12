export const ASSET_CLASS_IDS = [
  "domestic_stock",
  "developed_stock",
  "emerging_stock",
  "domestic_bond",
  "developed_bond",
  "emerging_bond",
  "domestic_reit",
  "developed_reit",
  "gold",
  "cash",
] as const;

export type AssetClassId = (typeof ASSET_CLASS_IDS)[number];

export const TAX_CATEGORIES = [
  "nisa",
  "tokutei",
  "ideco",
  "gold_physical",
] as const;

export type TaxCategory = (typeof TAX_CATEGORIES)[number];

export const TAX_CATEGORY_LABELS: Record<TaxCategory, string> = {
  nisa: "NISA",
  tokutei: "特定口座",
  ideco: "iDeCo",
  gold_physical: "金現物",
};

export interface AssetClassData {
  label: string;
  expectedReturn: number;
  risk: number;
}

export interface PortfolioEntry {
  id?: string;
  name?: string;
  assetClass: AssetClassId;
  taxCategory: TaxCategory;
  amount: number;
}

export interface PortfolioResult {
  expectedReturn: number;
  risk: number;
  weights: Record<AssetClassId, number>;
  totalAmount: number;
}
