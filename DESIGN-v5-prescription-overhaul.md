# 処方箋エンジン v5 — 収入増加軸 + アロケーション軸

## 概要

処方箋エンジンの壊れた `investment`（追加積立）軸を廃止し、`income`（収入増加）と `allocation`（アロケーション最適化）の2軸に差し替える。ユーザーが実際に取れるアクション4つ（支出削減・退職延期・収入増加・資産配分変更）に処方箋を対応させる。

## 問題

1. **`investment` 軸が論理破綻**: エンジンは既に「収入 − 生活費 = 全額積立」で動いている。NISA残高を仮想的に嵩上げする処方箋は「どこからともなく金が湧く」提案であり、ユーザーが行動に移せない
2. **ポートフォリオ最適化と処方箋が分断**: 効率的フロンティアUIは存在するが、「成功率N%に必要なリスク水準」を処方箋が教えない。最適化の結果がシミュレーション結果に接続されていない

## ターゲットユーザー

FIRE参謀のヘビーユーザー。処方箋を見て「年収を上げる副業を検討する」「退職後のポートフォリオを見直す」など、実際に行動を変える人。

## 提案するアプローチ（実用版 B）

### 変更1: `investment` → `income` 軸差し替え

**二分探索対象**: `annualSalary`（年収 = 給与 + 副業）

| 項目 | 値 |
|------|-----|
| 探索下限 | 現在の `annualSalary` |
| 探索上限 | `annualSalary * 2`（2倍まで） |
| 精度 | 10万円単位 |
| ラベル | `「年収を+X万円にする」` |
| デルタ | `+X万円/年` |
| 難易度 | ≤50万: easy, ≤150万: moderate, >150万: hard |

**ロジック**: 年収が増えれば `surplus = income - expense` が増え、積立が自動的に増える。既存のエンジンフローと完全に整合する。

### 変更2: `allocation` 軸追加（新規4軸目）

**アルゴリズム**:
1. 効率的フロンティアを**事前計算**して渡す（`EfficientFrontierPoint[]`）
2. フロンティア上の各点について `runSimulationLite` を実行
3. 目標成功率を満たす点のうち**最小リスク**のものを選択
4. 見つからなければ `null`（改善不可）

| 項目 | 値 |
|------|-----|
| 探索対象 | フロンティア上の点（リスク昇順、30点程度） |
| ラベル | `「リスクをX%→Y%に調整」` or `「期待リターンをX%→Y%に調整」` |
| デルタ | `リスク X% → Y%` |
| 難易度 | リスク変化≤2%: easy, ≤5%: moderate, >5%: hard |
| 付属データ | `recommendedAllocation: Record<AssetClassId, number>` （ウェイト） |

**フロンティアの受け渡し**: `generatePrescriptions` の引数に `frontier?: EfficientFrontierPoint[]` を追加。Worker側は呼び出し元（Results画面）が持つフロンティアデータを渡す。

### 変更3: 型の拡張

```typescript
// types.ts
export type PrescriptionAxis = "expense" | "retirement" | "income" | "allocation";

export interface Prescription {
  axis: PrescriptionAxis;
  label: string;
  currentValue: number;
  targetValue: number;
  delta: string;
  resultRate: number;
  difficulty: Difficulty;
  /** allocation軸のみ: 推奨アセットアロケーション */
  recommendedAllocation?: Record<string, number>;
}
```

### 変更4: Worker/SimulationWorker インターフェース

```typescript
// worker.ts の WorkerMessage 拡張
| { type: "prescribe"; input: SimulationInput; targetRate: number; seed: number; frontier?: EfficientFrontierPoint[] }

// use-simulation.ts の prescribe 引数拡張
async prescribe(input, targetRate, seed, frontier?): Promise<PrescriptionResult>
```

### 変更5: UI変更

`prescription-card.tsx`:
- アイコン追加: `income` → `Banknote` (lucide), `allocation` → `PieChart` (lucide)
- `allocation` 処方箋に「この配分を適用」ボタン追加（既存の `onApplyTarget` パターンを再利用）
- スケルトンUIを3→4枠に

`results.tsx`:
- `PrescriptionCard` にフロンティアデータを渡す prop 追加
- ポートフォリオ最適化の結果をキャッシュして処方箋に流す

## 技術的考慮事項

### パフォーマンス
- `allocation` 軸はフロンティア30点 × `runSimulationLite`(500試行) = 15,000試行。二分探索（25イテレーション × 500試行 = 12,500）と同程度
- 全4軸合計: ~55,000試行。現行3軸 ~37,500試行から約1.5倍。Web Workerで十分許容範囲

### フロンティアの事前計算タイミング
- Results画面マウント時に `optimizePortfolio` を呼ぶ（既存の PortfolioOptimizer と同じ）
- 結果をstateに保持し、PrescriptionCard に渡す
- 税制年度変更時はフロンティアを再計算

### 後方互換
- `investment` 軸の完全削除（deprecation期間なし。URL共有には影響しない — 処方箋はURL共有に含まれていない）
- `PrescriptionAxis` の型変更は破壊的だが、外部APIは存在しない

## エンジニアリングレビュー条件

1. **`income` 軸の上限ガード**: `hi = (input) => Math.max(input.annualSalary * 2, 10_000_000)`。`annualSalary = 0`（無職）でも探索幅ゼロにならない
2. **退職済みガード**: `retirementAge <= currentAge` なら `income` 軸をスキップ。既に退職した人に「年収を上げろ」は無意味
3. **Worker内でcalcFromWeightsを呼ばない**: `allocation` 軸はフロンティアの `{ expectedReturn, risk }` を `SimulationInput.allocation` に設定して `runSimulationLite` を呼ぶのみ。`asset-class-data.json` への依存をWorker内に持ち込まない

## デザインレビュー改訂

| # | 箇所 | ビフォー | アフター |
|---|------|---------|---------|
| 1 | `results.tsx` セクション説明 | `— 支出削減・退職延期・追加積立の3軸提案` | `— 支出削減・退職延期・収入増加・資産配分の4軸提案` |
| 2 | `results.tsx` 処方箋 `<details>` | 常に閉じ | `open={result.successRate < 0.9}` で成功率90%未満時に自動展開 |
| 3 | `prescription-card.tsx` アイコン | `investment: TrendingUp` | `income: Banknote`, `allocation: PieChart` |
| 4 | `prescription-card.tsx` PrescriptionItem | 全カード均等 | `resultRate` 最大のカードに `border-primary border-2` |
| 5 | `prescription-card.tsx` allocation軸 | なし | 「この配分を適用」ボタン + `onApplyAllocation` コールバック |
| 6 | `prescription-card.tsx` スケルトン | 3枠 | 4枠 |
| 7 | `prescription-card.tsx` 新prop | なし | `frontier?: EfficientFrontierPoint[]`, `onApplyAllocation?: (weights) => void` |

## 成功指標

1. 処方箋の4軸すべてが「ユーザーが実際に取れるアクション」に対応している
2. `allocation` 処方箋からワンクリックで目標アロケーションを適用できる
3. 処方箋セクションをスルーしなくなる（主観評価）

## スコープ外

- 複合処方箋（「年収+30万 AND リスク-2%」の組み合わせ提案）→ v6検討
- グライドパス提案（年齢に応じた配分シフト）→ v6検討
- 処方箋からシナリオ比較への直接ジャンプ → v6検討
- `sideIncome` 軸の追加（退職後の副収入を変える処方箋）→ v6検討

## 工数見積もり

| タスク | 人間 | AI |
|--------|------|-----|
| 設計レビュー・方針決定 | 30min | — |
| `income` 軸実装 + テスト | — | 1h |
| `allocation` 軸実装 + テスト | 15min（レビュー） | 2h |
| Worker/型拡張 | — | 30min |
| UI変更（アイコン・適用ボタン） | 15min（レビュー） | 1h |
| 既存テスト修正 | — | 30min |
| **合計** | **1h** | **5h** |

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/prescription/types.ts` | `PrescriptionAxis` に `income`, `allocation` 追加。`investment` 削除。`recommendedAllocation` フィールド追加 |
| `src/lib/prescription/engine.ts` | `AXIS_CONFIGS.investment` → `income` 差し替え。`allocation` 軸追加（フロンティア走査）。`generatePrescriptions` 引数にフロンティア追加 |
| `src/lib/simulation/worker.ts` | `WorkerMessage` にフロンティアデータ追加 |
| `src/lib/simulation/use-simulation.ts` | `prescribe` メソッドにフロンティア引数追加 |
| `src/components/prescription-card.tsx` | アイコン追加、`allocation` 用「適用」ボタン、フロンティア prop 追加 |
| `src/components/results.tsx` | フロンティアデータを PrescriptionCard に受け渡し |
| `src/lib/prescription/engine.test.ts` | テスト更新: `investment` → `income`、`allocation` テスト追加 |
| `src/components/prescription-card.test.tsx` | テスト更新 |
