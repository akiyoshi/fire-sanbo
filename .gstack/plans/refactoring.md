# FIRE参謀 リファクタリング計画

> **生成日**: 2026-04-18
> **分析モデル**: 3モデル（バックエンド: Claude Sonnet 4.6, フロントエンド: Claude Sonnet 4.6, テスト: Gemini 3.1 Pro）
> **統合判断**: Claude Opus 4.6
> **対象**: fire-sanbo v4.5.6（279テスト, ~2秒）

---

## クロスモデル統合サマリー

```
┌───────────────────────────────────────────┐
│ マルチモデル統合プラン                      │
├───────────────────────────────────────────┤
│ 分析モデル数: 3                            │
├───────────────────────────────────────────┤
│ 合意点（高信頼度）:                        │
│   1. form-state.ts は分割必須              │
│   2. results.tsx のサブコンポ抽出は低リスク │
│   3. マジックナンバー定数化は即実行可       │
│   4. prescription重複はmember-withdrawal   │
│      共通関数で吸収                        │
│   5. バレル再エクスポートでimport破壊ゼロ  │
│                                           │
│ 相違点（要判断）:                          │
│   A. Primary→MemberAccounts統一の時期     │
│      → 推奨: Phase 3で実施（最高リスク）   │
│   B. Context導入の是非                    │
│      → 推奨: 不要（prop階層は最大2段）     │
│   C. スナップショットテストの追加時期      │
│      → 推奨: Phase 3の前に追加            │
│                                           │
│ 独自発見（1モデルのみが指摘）:             │
│   - [BE] withdrawal/optimizer.tsの        │
│     getActiveCategories()がSpouse口座を    │
│     無視している（配偶者シナリオで不正確） │
│   - [FE] formRef.current手動同期が4箇所に │
│     散在（hookで一元化すべき）             │
│   - [FE] What-ifスライダーがSliderInputを │
│     使わず生の<Slider>を4本重複           │
│   - [QA] PRNG呼び出し順序がフェーズ分割で │
│     変わるとシード固定テストが全壊する     │
│   - [QA] form-state分割時の循環参照リスク  │
├───────────────────────────────────────────┤
│ 統合プラン: .gstack/plans/refactoring.md   │
│ 推奨する次のスキル: /tdd (Phase 1から開始) │
└───────────────────────────────────────────┘
```

---

## 工数見積もり

| フェーズ | 人間 | AI |
|----------|------|-----|
| Phase 1: 定数化 + サブコンポ抽出 | 3–4時間 | 30–45分 |
| Phase 2: form-state分割 + prescription重複解消 | 6–8時間 | 1–1.5時間 |
| Phase 3: Primary→MemberAccounts統一 | 8–12時間 | 2–3時間 |
| Phase 4: useResultsState hook抽出 | 4–6時間 | 45分–1時間 |
| **合計** | **21–30時間** | **4.5–6時間** |

---

## Phase 1: 低リスク抽出（即実行可）

### 1A. マジックナンバー定数化

**対象ファイル・行:**

| ファイル | 現状 | 定数名 |
|----------|------|--------|
| `simulation/helpers.ts:20` | `* 0.004` | `PENSION_EARLY_RATE_PER_MONTH` |
| `simulation/helpers.ts:22` | `* 0.007` | `PENSION_LATE_RATE_PER_MONTH` |
| `simulation/engine.ts:449` | `* 0.20315` | → `calcTokuteiTax()` に置換 |
| `tax/engine.ts` | `500_000` / `0.5` | `GOLD_SPECIAL_DEDUCTION` / `GOLD_LONG_TERM_RATIO` |

**テスト影響**: なし（値は不変、参照方法のみ変更）

### 1B. results.tsx サブコンポーネント抽出

**新規ファイル:**

```
src/components/results/
  success-rate-display.tsx     ← results.tsx 行38–85
  asset-chart.tsx              ← results.tsx 行86–200（Recharts import移動）
  share-button.tsx             ← results.tsx 行200–240
  save-scenario-button.tsx     ← results.tsx 行240–300
```

**ルール:**
- 各コンポーネントのProps型を明示的に定義
- Recharts importは `asset-chart.tsx` に集約
- `results.tsx` は ~400行に縮小（Phase 4でさらに150行へ）

**テスト影響**: `e2e/app.spec.ts` のセレクタが変わらない限り影響なし

### 1C. wizard.tsx から CollapsibleCard 抽出

**新規ファイル:**
```
src/components/wizard/collapsible-card.tsx  ← wizard.tsx 行180–220
```

**テスト影響**: `wizard.test.tsx` の `getByText` アサーションに影響なし

---

## Phase 2: コア分割

### 2A. form-state.ts 5分割

**新規ファイル構成:**

```
src/lib/form/
  types.ts          ← FormState, SpouseFormState, Scenario, SimulationInput 型定義
  storage.ts        ← saveForm / loadForm / clearForm + localStorage定数
  scenarios.ts      ← saveScenario / updateScenario / deleteScenario / loadScenarios
  derive.ts         ← deriveBalancesByTaxCategory / deriveAccountAllocations
                       deriveRebalanceConfig / deriveTargetAccountWeights
  io.ts             ← exportFormToJSON / importFormFromJSON / FORM_SCHEMA_VERSION
```

**既存ファイル変更:**
```
src/lib/form-state.ts  ← 全実装削除、バレル再エクスポートのみ
```

**バレルファイル例:**
```typescript
// src/lib/form-state.ts (変更後)
export * from "./form/types";
export * from "./form/storage";
export * from "./form/scenarios";
export * from "./form/derive";
export * from "./form/io";
```

**リスク対策:**
- 循環参照チェック: `types.ts` は他を参照しない。他4ファイルは `types.ts` のみ参照
- 29箇所のインポートパス変更ゼロ（バレル再エクスポート維持）
- `form-state.test.ts` はそのまま通る

### 2B. member-withdrawal.ts 共通関数作成

**新規ファイル:**
```
src/lib/simulation/member-withdrawal.ts
```

**関数シグネチャ:**
```typescript
interface MutableTaxOpts {
  age: number;
  cfg: TaxConfig;
  comprehensiveIncome: number;  // mutable — gold取り崩し時に累積
}

function withdrawFromMember(
  accts: MemberAccounts,
  deficit: number,
  order: TaxCategory[],
  txOpts: MutableTaxOpts,
  costBasis?: CostBasis
): { drawn: number; tax: number; comprehensiveIncome: number }
```

**適用先:**
- `simulation/engine.ts`: 退職後取り崩しのdual-passループ → 2呼び出しに置換
- `prescription/engine.ts`: `runTrialLite()` 取り崩しループ ~60行 → 1呼び出しに置換

**テスト:**
- 新規 `simulation/member-withdrawal.test.ts` を追加
- 既存の `simulation/engine.test.ts` と `prescription/engine.test.ts` が全pass維持

**注意点（Gemini指摘）:**
- PRNG呼び出し順序が変わらないことを確認（関数抽出のみ、乱数は呼ばない箇所）
- `remaining -= result.net` のNET/GROSS意味論を維持（prescriptionの簡略化設計を引き継ぐ）

---

## Phase 3: Primary→MemberAccounts統一（最高リスク）

### 前提条件（必ずPhase 3前に実施）

1. **スナップショットテスト追加**: `runSimulation()` の出力JSON（成功率、資産推移中央値、税負担合計）を固定シードで記録し、1円単位でズレを検出
2. **Phase 1–2のテスト全pass確認**

### 変更内容

**`simulation/engine.ts`:**
```
変更前: pNisa, pTokutei, pIdeco, pGold, pCash (スカラー5本)
変更後: pAccts: MemberAccounts (Spouseと同じ構造体)
```

**影響範囲:**
- 退職前積立ロジック: `pNisa +=` → `pAccts.nisa +=`
- 退職後取り崩し: すでにPhase 2Bで `withdrawFromMember(pAccts, ...)` に移行済み
- リバランスフェーズ（engine.ts:395–510行, 130行）: 全変数参照を `pAccts.*` に読み替え — **変更箇所最多・最高リスク区画**
- CostBasis: `pCostBasis` は別オブジェクトのため影響小

**テスト戦略（Gemini推奨を採用）:**
1. スナップショットテストで出力不変を確認
2. リバランスフェーズは行単位で慎重に変換
3. `iDecoLocked = age < 60` のロジックが `pAccts.ideco` 参照に正しく移行されたか確認

### 2次修正

**`withdrawal/optimizer.ts` の `getActiveCategories()` 修正:**
- 現状: Primary口座のみ参照
- 修正: `input.spouse` 存在時、Spouse口座も `categories` にマージ
- 配偶者ありシナリオで最適順が正しく探索されるようになる（Sonnet独自発見）

---

## Phase 4: useResultsState hook抽出

### 新規ファイル

```
src/components/results/use-results-state.ts
src/components/results/what-if-sliders.tsx
```

### useResultsState に集約する状態

| 状態 | 現在の場所 |
|------|-----------|
| `form` / `setForm` / `formRef` | Results本体 (4箇所で手動同期) |
| `result` / `setResult` / `isCalculating` | Results本体 |
| `debounceRef` / `generationRef` | Results本体 |
| `withdrawalResult` / `woDebounceRef` | Results本体 |
| `triggerRecalc` / `updateAndRecalc` | Results本体 |
| `topPrescription` / `applyBadge` | Results本体 |
| apply系コールバック4つ | Results本体 |

**hookで解決する問題:**
- `formRef.current = newForm` の4箇所散在 → `setFormAndSync()` に一元化
- 2つの `debounceRef` cleanup → 単一 `useEffect` に統合
- `triggerRecalc` の `result.successRate` deps連鎖 → `successRateRef` で安定化

### what-if-sliders.tsx

- 生の `<Slider>` 4本 → `wizard/shared.tsx` の `SliderInput` に置換
- Props: `form: FormState`, `onUpdate: (key, value) => void`

**Phase 4の結果**: `results.tsx` が ~150行に縮小

---

## 実施順序とゲート

```
Phase 1A (定数化)
  │  テスト全pass ✓
  ▼
Phase 1B+1C (サブコンポ抽出)
  │  テスト全pass + E2E pass ✓
  ▼
Phase 2A (form-state分割)
  │  テスト全pass + ビルド成功 ✓
  ▼
Phase 2B (member-withdrawal共通化)
  │  テスト全pass + 新規テスト追加 ✓
  ▼
Phase 3前提 (スナップショットテスト追加)
  │
  ▼
Phase 3 (Primary→MemberAccounts)
  │  スナップショット不変 + テスト全pass ✓
  ▼
Phase 4 (useResultsState)
  │  テスト全pass + E2E pass ✓
  ▼
完了
```

各Phaseは独立してマージ可能。Phase間のゲート（テスト全pass）を通過してから次へ進むこと。

---

## リスクまとめ

| リスク | 深刻度 | 対策 | 発見モデル |
|--------|--------|------|-----------|
| PRNG呼び出し順序変更でシード固定テスト全壊 | 高 | Phase 2B: 乱数を呼ばない箇所のみ抽出 | Gemini |
| リバランスフェーズ130行の変数読み替えミス | 高 | Phase 3: スナップショットテスト前提 | Sonnet(BE) |
| formRef二重参照（hook移行中間状態） | 中 | Phase 4: hook抽出+results更新を同一コミット | Sonnet(FE) |
| form分割で循環参照 | 中 | types.tsが単方向依存の頂点になる設計 | Gemini |
| prescription の NET/GROSS 意味論ズレ | 中 | withdrawFromMemberが既存挙動を維持 | Sonnet(BE) |
| getActiveCategories Spouse口座漏れ | 低 | Phase 3で修正 | Sonnet(BE) |
| NaN/丸め誤差で税額1–2円ズレ | 低 | 定数化は値を変えない、Math.round適用箇所不変 | Gemini |

---

## 使用モデルと分析要約

| 観点 | モデル | コスト | 主な発見 |
|------|--------|--------|---------|
| バックエンド設計 | Claude Sonnet 4.6 | 1x | Primary/Spouse非対称、prescription重複150行、getActiveCategories Spouse漏れ |
| フロントエンド設計 | Claude Sonnet 4.6 | 1x | results.tsx 700行の責務分離、formRef 4箇所散在、What-if重複 |
| テスト戦略 | Gemini 3.1 Pro | 1x | PRNG順序リスク、スナップショットテスト必須、循環参照チェック |
| 統合判断 | Claude Opus 4.6 | 3x | Phase順序決定、リスク優先度統合、Context不要判断 |

**合計コスト**: 6x プレミアムリクエスト
