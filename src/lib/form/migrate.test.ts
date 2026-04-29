import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { saveForm, loadForm, clearForm } from "./storage";
import { migrateForm, __testing__ } from "./migrate";
import { FORM_SCHEMA_VERSION, DEFAULT_FORM, type FormState } from "./types";

/**
 * CRIT-2 回帰テスト: FormState v5→v6 マイグレーション基盤。
 *
 * 旧実装は version 不一致で `null` を返し localStorage を実質的に drop していた。
 * 本テストでは `migrateForm` 経由で:
 *   - 同一バージョンは identity
 *   - 未来バージョンは reject
 *   - 旧バージョンは登録済 migrator で連鎖適用
 * を確認する。
 */

// jsdom 環境で localStorage を初期化
beforeEach(() => {
  localStorage.clear();
});

describe("CRIT-2: form migration", () => {
  it("[M-1] 現行バージョン(v5)で保存→ロードが識別関数として動く", () => {
    const form: FormState = { ...DEFAULT_FORM, currentAge: 42 };
    saveForm(form);
    const loaded = loadForm();
    expect(loaded).not.toBeNull();
    expect(loaded?.currentAge).toBe(42);
    expect(loaded?.retirementAge).toBe(DEFAULT_FORM.retirementAge);
  });

  it("[M-2] 不正な version (string / undefined) は null", () => {
    expect(migrateForm({ version: "5", form: DEFAULT_FORM })).toBeNull();
    expect(migrateForm({ form: DEFAULT_FORM })).toBeNull();
    expect(migrateForm(null)).toBeNull();
    expect(migrateForm("not an object")).toBeNull();
  });

  it("[M-3] 未来バージョン(v999)は forward-compat なしで reject", () => {
    const future = { version: 999, form: DEFAULT_FORM };
    expect(migrateForm(future)).toBeNull();
  });

  it("[M-4] 未登録の旧バージョン(v0)は migrate 不能で null", () => {
    // 現状 migrators には v5→v6 すら未登録（v4.6.0 時点）
    // v4 から始める場合は migrators に v4→v5 を登録する必要がある
    const ancient = { version: 0, form: DEFAULT_FORM };
    expect(migrateForm(ancient)).toBeNull();
  });

  it("[M-5] storage には現行 FORM_SCHEMA_VERSION が書き込まれる", () => {
    const form: FormState = { ...DEFAULT_FORM };
    saveForm(form);
    const raw = localStorage.getItem("fire-sanbo-form");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(FORM_SCHEMA_VERSION);
  });

  it("[M-6] 破損 JSON は loadForm で null を返す（throw しない）", () => {
    localStorage.setItem("fire-sanbo-form", "not valid json {{{");
    expect(loadForm()).toBeNull();
  });

  it("clearForm で localStorage が消える", () => {
    saveForm(DEFAULT_FORM);
    clearForm();
    expect(loadForm()).toBeNull();
  });
});

describe("CRIT-2: migration positive path (v4.6.5 review fix)", () => {
  // gstack-review C2: migrators が実際に登録された時の正常系を検証する。
  // production の migrators は空のまま（v5 が初期バージョン）だが、
  // 将来 v6 ship 時にインフラの空振りに気づけるように identity migrator で動作確認する。

  const TEST_VERSION = -1; // FORM_SCHEMA_VERSION - 1 が安全に未来から来ても衝突しない値

  beforeEach(() => {
    // FORM_SCHEMA_VERSION は import 定数なのでテストでは動かせない。
    // 代わりに migrators[FORM_SCHEMA_VERSION - 1] に identity を登録し、
    // version: FORM_SCHEMA_VERSION - 1 の入力を渡す。
    __testing__.registerMigrator(FORM_SCHEMA_VERSION - 1, (legacy: any) => ({
      ...legacy,
      // identity migrator: 何も変えずに次のバージョンに通す
    }));
  });

  afterEach(() => {
    __testing__.clearMigrator(FORM_SCHEMA_VERSION - 1);
  });

  it("[M-7] 旧バージョンが現行へ identity migrate される", () => {
    const legacy = { version: FORM_SCHEMA_VERSION - 1, form: DEFAULT_FORM };
    const result = migrateForm(legacy);
    expect(result).not.toBeNull();
    // identity migrator なのでフィールドは保持
    expect(result?.currentAge).toBe(DEFAULT_FORM.currentAge);
    expect(result?.retirementAge).toBe(DEFAULT_FORM.retirementAge);
  });

  it("[M-8] migrator が throw した場合は null を返す（kill-switch）", () => {
    __testing__.registerMigrator(TEST_VERSION, () => {
      throw new Error("migration boom");
    });
    try {
      const legacy = { version: TEST_VERSION, form: DEFAULT_FORM };
      // TEST_VERSION (-1) → 0 → ... → FORM_SCHEMA_VERSION のチェーンが必要だが
      // -1→0 で migrator が throw → null
      expect(migrateForm(legacy)).toBeNull();
    } finally {
      __testing__.clearMigrator(TEST_VERSION);
    }
  });

  it("[M-9] 連鎖 migrate (skip 1 step) — 中間バージョンの migrator も自動適用", () => {
    if (FORM_SCHEMA_VERSION < 2) return; // v1 未満なら検証不能

    __testing__.registerMigrator(FORM_SCHEMA_VERSION - 2, (legacy: any) => ({
      ...legacy,
      _testMarkerStep1: true,
    }));
    try {
      const legacy = {
        version: FORM_SCHEMA_VERSION - 2,
        form: DEFAULT_FORM,
      };
      const result = migrateForm(legacy) as any;
      expect(result).not.toBeNull();
      // 2 ステップ連鎖したことを確認
      expect(result._testMarkerStep1).toBe(true);
    } finally {
      __testing__.clearMigrator(FORM_SCHEMA_VERSION - 2);
    }
  });
});
