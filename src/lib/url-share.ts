import { deflateRaw, inflateRaw } from "pako";
import { importFormFromJSON } from "@/lib/form-state";
import type { FormState } from "@/lib/form-state";

const SHARE_PREFIX = "#s=";
const FORM_SCHEMA_VERSION = 3;
const MAX_PORTFOLIO_ENTRIES = 8;
const MAX_LABEL_LENGTH = 50;
const SHARED_NUM_TRIALS = 1000;

/** Base64url encode (RFC 4648 §5, no padding) */
function toBase64url(bytes: Uint8Array): string {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Base64url decode */
function fromBase64url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  const bin = atob(b64 + "=".repeat(pad));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** FormState → DeflateRaw + Base64url 文字列 */
export function compressForm(form: FormState): string {
  const shareable: FormState = {
    ...form,
    numTrials: SHARED_NUM_TRIALS,
    portfolio: form.portfolio.slice(0, MAX_PORTFOLIO_ENTRIES),
    lifeEvents: form.lifeEvents?.map((e) => ({
      ...e,
      label: e.label.slice(0, MAX_LABEL_LENGTH),
    })),
  };
  if (shareable.spouse) {
    shareable.spouse = {
      ...shareable.spouse,
      portfolio: shareable.spouse.portfolio.slice(0, MAX_PORTFOLIO_ENTRIES),
    };
  }
  const json = JSON.stringify({ version: FORM_SCHEMA_VERSION, form: shareable });
  const compressed = deflateRaw(new TextEncoder().encode(json));
  return toBase64url(compressed);
}

/** Base64url 文字列 → FormState（失敗時 null） */
export function decompressForm(encoded: string): FormState | null {
  try {
    const compressed = fromBase64url(encoded);
    const json = new TextDecoder().decode(inflateRaw(compressed));
    return importFormFromJSON(json);
  } catch {
    return null;
  }
}

/** FormState → 共有用フルURL */
export function buildShareUrl(form: FormState, base: string): string {
  return base + SHARE_PREFIX + compressForm(form);
}

/** 現在のURLから共有データを抽出（なければ null） */
export function parseShareHash(hash: string): FormState | null {
  if (!hash.startsWith(SHARE_PREFIX)) return null;
  const encoded = hash.slice(SHARE_PREFIX.length);
  if (!encoded) return null;
  return decompressForm(encoded);
}
