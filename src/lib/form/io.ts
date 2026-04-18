import type { FormState } from "./types";
import { FORM_SCHEMA_VERSION } from "./types";

export function exportFormToJSON(form: FormState): string {
  return JSON.stringify({ version: FORM_SCHEMA_VERSION, form }, null, 2);
}

export function importFormFromJSON(json: string): FormState | null {
  try {
    const data = JSON.parse(json);
    const form = data.form;
    // 基本的なバリデーション（v2/v3共通）
    if (!form || typeof form !== "object") return null;
    if (typeof form.currentAge !== "number" || typeof form.monthlyExpense !== "number") return null;
    if (typeof form.retirementAge !== "number" || typeof form.endAge !== "number") return null;
    if (typeof form.annualSalary !== "number") return null;
    if (!Array.isArray(form.portfolio)) return null;
    if (form.portfolio.length > 20) return null;
    for (const entry of form.portfolio) {
      if (typeof entry.assetClass !== "string" || typeof entry.taxCategory !== "string" || typeof entry.amount !== "number") {
        return null;
      }
    }
    if (form.lifeEvents && (!Array.isArray(form.lifeEvents) || form.lifeEvents.length > 30)) return null;
    if (form.spouse && typeof form.spouse === "object") {
      if (form.spouse.portfolio && (!Array.isArray(form.spouse.portfolio) || form.spouse.portfolio.length > 20)) return null;
    }
    // v4.3: targetAllocation バリデーション
    if (form.targetAllocation) {
      if (!Array.isArray(form.targetAllocation) || form.targetAllocation.length > 20) return null;
      for (const t of form.targetAllocation) {
        if (typeof t.assetClass !== "string" || typeof t.weight !== "number") return null;
        // 不正なウェイト値をクランプ
        t.weight = Math.max(0, Math.min(1, t.weight));
      }
    }
    if (data.version !== FORM_SCHEMA_VERSION) return null;
    return form as FormState;
  } catch {
    return null;
  }
}
