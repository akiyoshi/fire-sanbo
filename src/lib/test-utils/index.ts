/**
 * テスト共通ユーティリティのバレル。
 *
 * 利用例:
 *   import { createSimulationInput, expectPercentilesOrdered } from "@/lib/test-utils";
 *
 * このモジュールはテストファイル (`*.test.ts(x)`, `*.spec.ts(x)`) からのみ
 * import すること。本番コードからの import は禁止。
 */

export {
  createMemberAccounts,
  createSimulationInput,
  createSpouseInput,
  createTrialResult,
  createYearResult,
} from "./fixtures";

export { expectInRange, expectPercentilesOrdered } from "./assertions";
