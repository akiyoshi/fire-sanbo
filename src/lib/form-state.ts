// バレル再エクスポート — 29箇所のimportパスを維持
export type { FormState, SpouseFormState, Scenario } from "./form/types";
export { DEFAULT_FORM, FORM_SCHEMA_VERSION, VALID_TAX_CATEGORIES } from "./form/types";
export { loadScenarios, saveScenarios, saveScenario, updateScenario, deleteScenario } from "./form/scenarios";
export { saveForm, loadForm, clearForm } from "./form/storage";
export { exportFormToJSON, importFormFromJSON } from "./form/io";
export {
  deriveBalancesByTaxCategory,
  deriveAccountAllocations,
  deriveRebalanceConfig,
  deriveTargetAccountWeights,
  formToSimulationInput,
} from "./form/derive";

