import type { FormState } from "./types";
import { FORM_SCHEMA_VERSION } from "./types";

/**
 * FormState スキーマのマイグレーション。
 *
 * 設計方針 (CRIT-2 / autoplan v4.6 review):
 * - storage / url-share / json-import の version 不一致時に「黙って drop」していた
 *   旧実装は破壊的（既存ユーザーの localStorage を消失させる）。
 * - 本モジュールは旧バージョンを順次 up-migrate する。マイグレーション失敗時のみ null を返す。
 * - 各 vN → v(N+1) ステップを `migrators[N]` として登録し、必要分だけ連鎖適用する。
 *
 * 将来のスキーマバンプ (例: v5 → v6 で IdecoConfig 追加) はこの map に1行追加するだけで済む。
 */

type Migrator = (form: any) => any;

/**
 * バージョン N → N+1 のマイグレータ登録。
 * 現状 v4.6.0 は v5 のみだが、infra を先に入れることで v6 以降の追加が安全になる。
 */
const migrators: Record<number, Migrator> = {
  // v5 → v6 はまだ未定義（v4.6.3 で IdecoConfig 追加時に実装予定）
};

/**
 * 任意バージョンの保存データを現行バージョンへ migrate する。
 *
 * @param stored - `{ version: number, form: any }` 形式のオブジェクト
 * @returns 現行バージョンの FormState、または migrate 不能なら null
 */
export function migrateForm(stored: unknown): FormState | null {
  if (!stored || typeof stored !== "object") return null;
  const data = stored as { version?: unknown; form?: unknown };
  if (typeof data.version !== "number" || !data.form || typeof data.form !== "object") return null;

  let version = data.version;
  let form: any = data.form;

  // 現行より新しいバージョンは安全側で reject (forward-compat なし)
  if (version > FORM_SCHEMA_VERSION) return null;

  // 古いバージョン → 順次 up-migrate
  while (version < FORM_SCHEMA_VERSION) {
    const migrator = migrators[version];
    if (!migrator) {
      // 未登録のステップ → migrate 不能
      return null;
    }
    try {
      form = migrator(form);
    } catch {
      return null;
    }
    version += 1;
  }

  return form as FormState;
}
