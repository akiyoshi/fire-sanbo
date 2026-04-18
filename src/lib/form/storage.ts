import type { FormState } from "./types";
import { FORM_SCHEMA_VERSION } from "./types";

const STORAGE_KEY = "fire-sanbo-form";

interface StoredForm {
  version: number;
  form: FormState;
}

export function saveForm(form: FormState): void {
  try {
    const data: StoredForm = { version: FORM_SCHEMA_VERSION, form };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage 満杯・プライベートモード等 → 黙って無視
  }
}

export function loadForm(): FormState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: StoredForm = JSON.parse(raw);
    if (data.version === FORM_SCHEMA_VERSION) return data.form;
    // v5以外は非対応 → null（DEFAULT_FORMで初期化される）
    return null;
  } catch {
    return null;
  }
}

export function clearForm(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無視
  }
}
