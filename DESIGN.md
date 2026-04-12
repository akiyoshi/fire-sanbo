# FIRE参謀 — 処方箋（Prescription）機能 デザインドキュメント

> **ステータス**: Reviewed — /plan-eng-review APPROVE (条件付き)
> **スプリント**: Sprint 5
> **前提**: v0.2.0 (モンテカルロ + 税制エンジン + What-if) が完成済み

## 概要

シミュレーション結果の「成功確率 X%」を見た後、ユーザーが「成功確率を Y% にするには何を変えればいい？」と聞ける機能。3つの軸（支出削減・退職時期・追加投資）で逆算し、Top 3 の処方箋を自動生成する。

**FIRE参謀を「電卓」から「参謀」に変える分水嶺。**

## 問題

現在のFIRE参謀は「答えを出す」で終わる。成功確率67%と表示された後、ユーザーは：

1. What-ifスライダーを**手動で**何十回も動かして、どの変数が効くか探す
2. 「退職を2年遅らせるのと、月3万円節約するのと、どっちが効く？」が**比較できない**
3. 最終的に**感覚**で判断する — これでは参謀ではなく電卓

## ターゲットユーザー

v0.2.0と同一: NISA/iDeCo運用中の30-45歳ITエンジニア。ただし処方箋が刺さるのは特に「成功確率が60-85%」のゾーンにいるユーザー。90%超の人は処方箋不要、40%未満の人は抜本的見直しが必要。

## 提案するアプローチ

### 処方箋エンジン（Prescription Engine）

3つの「処方箋軸」に対して、目標成功率を達成するパラメータを二分探索で逆算する。

#### 処方箋の3軸

| 軸 | パラメータ | 探索範囲 | 単調性 |
|----|-----------|---------|--------|
| **支出削減** | monthlyExpense | 現在値 → 50,000円 | 支出↓ = 成功率↑ ✓ |
| **退職時期** | retirementAge | 現在値 → 75歳 | 遅延↑ = 成功率↑ ✓ |
| **追加投資** | nisaBalance（年額積立で換算） | 0 → 月10万円追加 | 投資↑ = 成功率↑ ✓ |

3軸とも成功率に対して単調なので、二分探索で O(log N) 回のシミュレーションで解ける。

#### アルゴリズム

```
findPrescription(axis, targetRate, currentInput):
  lo = currentValue
  hi = axisMax
  while hi - lo > precision:
    mid = (lo + hi) / 2
    input = clone(currentInput, axis: mid)
    result = runSimulation(input)  // seed固定で再現性確保
    if result.successRate >= targetRate:
      hi = mid
    else:
      lo = mid
  return hi
```

- 各軸15-20回のシミュレーション（二分探索）
- 1,000試行/回 × 20回 = ~2-10秒/軸
- 3軸並列実行（3 Worker）で ~3-10秒

#### 処方箋の出力形式

```typescript
interface Prescription {
  axis: "expense" | "retirement" | "investment";
  label: string;          // "月3.2万円の支出削減"
  currentValue: number;
  targetValue: number;
  delta: string;          // "-32,000円/月" or "+2年"
  resultRate: number;     // 達成される成功率
  difficulty: "easy" | "moderate" | "hard";
}
```

#### 難易度の判定基準

| 難易度 | 支出削減 | 退職延期 | 追加投資 |
|--------|---------|---------|---------|
| easy | < 2万円/月 | +1年 | < 2万円/月 |
| moderate | 2-5万円/月 | +2-3年 | 2-5万円/月 |
| hard | > 5万円/月 | +4年以上 | > 5万円/月 |

### UI設計

結果画面の成功確率カードの直下に「処方箋」セクションを追加。

```
┌──────────────────────────────────────────────┐
│ FIRE成功確率: 67%                             │
│ ████████████████░░░░░░░░                     │
│                                              │
│ 📋 成功率を 90% にするには？  [目標: ●90%]    │
│                                              │
│ ┌─ 処方箋A ──────────────────── easy ───┐    │
│ │ 月2.8万円の支出削減                    │    │
│ │ 25.0万円/月 → 22.2万円/月             │    │
│ │ 成功率: 67% → 90%                     │    │
│ └──────────────────────────────────────┘    │
│                                              │
│ ┌─ 処方箋B ──────────────── moderate ──┐    │
│ │ 退職を2年遅らせる                      │    │
│ │ 50歳 → 52歳                           │    │
│ │ 成功率: 67% → 91%                     │    │
│ └──────────────────────────────────────┘    │
│                                              │
│ ┌─ 処方箋C ──────────────── moderate ──┐    │
│ │ 月3.5万円の追加積立（NISA）            │    │
│ │ 成功率: 67% → 90%                     │    │
│ └──────────────────────────────────────┘    │
│                                              │
│ 💡 処方箋Aが最も実行しやすい選択肢です       │
└──────────────────────────────────────────────┘
```

### 目標成功率の選択

- デフォルト: 90%
- スライダーで80%〜99%を選択可能
- 現在の成功率がすでに目標以上の場合: 「現在のプランで目標達成済みです 🎉」

## 技術的考慮事項

### エンジニアリングレビューで追加された要件

#### B1: `runSimulationLite()` の追加 (ブロッカー)

現在の`runSimulation()`は全TrialResult（年次詳細）をメモリに保持する。処方箋の二分探索で60回呼ぶと最大360MBに達し、モバイルでタブクラッシュの可能性がある。

対策: `engine.ts`に`runSimulationLite(input): { successRate: number }`を追加。percentiles・trial詳細の計算をスキップし、成功率のみ返す。二分探索の各反復ではこれを使う。

#### B2: Worker内で二分探索ループを実行 (ブロッカー)

「メインスレッドから20回Workerを呼ぶ」のではなく、Worker内で`findPrescription(axis, input, targetRate, seed)`を実行する。メインスレッドとの通信は1往復のみ。

Workerメッセージ型の拡張:
```typescript
export type WorkerMessage =
  | { type: "run"; input: SimulationInput }
  | { type: "prescribe"; input: SimulationInput; targetRate: number; seed: number }
  | { type: "cancel" };

export type WorkerResponse =
  | { type: "result"; data: SimulationResult }
  | { type: "prescriptions"; data: Prescription[] }
  | { type: "error"; message: string };
```

### 再利用可能な既存インフラ

| コンポーネント | 再利用方法 |
|--------------|-----------|
| `runSimulation()` | 処方箋の各反復でそのまま呼び出し |
| PRNG seed | 全軸で同一seedを使い、ランダム性による差分を排除 |
| `SimulationWorker` | 3軸並列実行。1 Workerに1軸を割り当て |
| `formToSimulationInput()` | パラメータ変更後の再変換 |
| `optimizeWithdrawalOrder()` | 処方箋と組み合わせて最良の取崩し順序も提示可能 |

### 新規コード

| ファイル | 内容 | 推定行数 |
|---------|------|---------|
| `src/lib/prescription/engine.ts` | 二分探索 + 3軸処方箋生成 + `runSimulationLite()` | ~150行 |
| `src/lib/prescription/types.ts` | Prescription型定義 | ~30行 |
| `src/lib/prescription/engine.test.ts` | テスト (14ケース) | ~120行 |
| `src/components/prescription-card.tsx` | 処方箋UIコンポーネント | ~100行 |
| `src/lib/simulation/worker.ts` | `prescribe`メッセージハンドラ追加 | ~20行 |

**合計**: ~330行の新規コード

### パフォーマンス見積もり

| 条件 | 計算量 | 予想時間 |
|------|--------|---------|
| 1軸 / 1,000試行 / 20反復 | 20,000,000年次ステップ | ~2-5秒 |
| 3軸並列 / 1,000試行 / 20反復 | 60,000,000年次ステップ | ~3-10秒 |
| 3軸並列 / 500試行 / 15反復 | 22,500,000年次ステップ | ~1-3秒 |

推奨: 処方箋計算中は500試行に減らし、速度を優先。精度は±2-3%程度の差で許容範囲。

### seed固定戦略

処方箋の3軸比較では、ランダム性による差分をゼロにするために**全軸で同一seedを使う**。
これにより「支出削減 vs 退職延期」の比較が純粋にパラメータの効果のみを反映する。

## 成功指標

| 指標 | 目標値 |
|------|--------|
| 処方箋表示までの時間 | < 5秒 |
| 処方箋の精度 | 目標成功率との誤差 ±3% |
| 3軸すべてで解が見つかる | 現在の成功率が10-85%の範囲 |
| ユーザーが処方箋を見て What-if を調整する率 | > 50%（要計測） |

## エッジケース

| # | ケース | 対処 |
|---|--------|------|
| 1 | 成功率が既に目標以上 | 「目標達成済み 🎉」メッセージ |
| 2 | どの軸でも目標に到達不可能 | 「単一の変更では目標に届きません。複合的な見直しが必要です」 |
| 3 | 支出を下限(50,000円)まで下げても不足 | 該当軸を「不可」としてスキップ |
| 4 | 退職年齢を75歳にしても不足 | 同上 |
| 5 | 処方箋計算中に What-if スライダーが動かされる | 計算をキャンセルして再実行 |

## スコープ外（Sprint 5）

- 複合処方箋（「支出-2万 + 退職+1年」の組合せ最適化）
- 年金繰下げ軸（年金モデル未実装のため）
- 処方箋のPDF出力
- 処方箋の時系列保存・比較

## 工数見積もり

| タスク | 工数 |
|--------|------|
| 処方箋エンジン（二分探索） | 2-3時間 |
| 型定義 + テスト | 1-2時間 |
| UIコンポーネント | 2-3時間 |
| Results統合 + Worker対応 | 1-2時間 |
| テスト + レビュー | 1-2時間 |
| **合計** | **7-12時間** |

## ハンドオフ

- `/plan-eng-review` — 二分探索の精度・Worker並列化の設計確認
- `/plan-design-review` — 処方箋カードのUI/UXレビュー
- `/autoplan` — 全レビューを一括で走らせる
- 直接実装に進む場合は「処方箋を実装して」と指示

---

# 税金の見える化（Tax Transparency）デザインドキュメント

> **ステータス**: Draft
> **スプリント**: Sprint 6
> **前提**: v0.2.0 完成済み。処方箋機能と並行 or 直後

## 概要

シミュレーション結果に**税金ブレイクダウンカード**を追加し、退職1年目と退職10年目の税金・社保の内訳を具体的な金額で表示する。FIRE参謀が日本の税制を精密に反映していることを、数字で証明する。

**既存の日本FIREツールで税金の内訳を可視化しているものはゼロ。これが差別化の窓になる。**

## 問題

FIRE参謀の税制エンジンは所得税7段階・住民税・社保・NISA非課税・特定口座20.315%・iDeCo退職所得控除を精密に計算している。しかし結果画面にはその証拠がどこにもない。

- `YearResult.tax` は合計値1つのみ。内訳はエンジン内部で計算されるが、捨てられている
- 結果画面に「税引後」の表記がない
- 開発者自身ですら「税金が反映されているか」を確認する手段がない
- 他の無料FIREツールと同列に見え、差別化ポイントが完全に埋没している

## ターゲットユーザー

NISA/iDeCo運用中の30-45歳ITエンジニア（v0.2.0と同一）。特に「他のFIREツールは税金を考慮していないから信用できない」と感じているが、FIRE参謀も同じに見えてしまっている層。

## 提案するアプローチ

### 1. エンジン改修: `YearResult` に税金内訳を追加

現在の `YearResult.tax: number` を `TaxBreakdown` オブジェクトに拡張する。

```typescript
interface TaxBreakdown {
  incomeTax: number;        // 所得税（復興特別所得税含む）
  residentTax: number;      // 住民税
  socialInsurance: number;  // 社会保険料（国保+国民年金）
  withdrawalTax: number;    // 取り崩し時の税金（特定口座・iDeCo）
  total: number;            // 合計
}

interface YearResult {
  age: number;
  totalAssets: number;
  nisa: number;
  tokutei: number;
  ideco: number;
  income: number;
  expense: number;
  taxBreakdown: TaxBreakdown;  // ← tax: number から拡張
  withdrawal: number;
  portfolioReturn: number;
}
```

**後方互換**: `tax` フィールドを `taxBreakdown.total` のゲッターとして残すか、一括変更するかはエンジニアリングレビューで決定。

### 2. シミュレーションエンジン (`runTrial`) の変更

現在の `runTrial()` で既に `calcAnnualTax()` と `calcWithdrawalTax()` を呼んでいる。返り値の内訳を捨てずに `TaxBreakdown` に詰めるだけ。ロジック変更なし、データ保持の変更のみ。

#### 退職前（給与所得がある年）
```typescript
const taxResult = calcAnnualTax(input.annualSalary, age);
// 既に incomeTax, residentTax, socialInsurance が返ってきている
// → これを TaxBreakdown に詰める
```

#### 退職後（取り崩しフェーズ）
```typescript
const retiredSocialInsurance = calcSocialInsurancePremium(0, age);
// 各口座の calcWithdrawalTax() の result.tax を集計
// → withdrawalTax に合算
```

### 3. UI: 税金ブレイクダウンカード

結果画面のタブ（概要 / 処方箋）に「税金」タブを追加。または概要タブ内に配置。

#### 表示する2枚のカード

**退職1年目** と **退職10年目** のp50（中央値）試行から税金内訳を抽出。

```
┌─ 退職1年目（51歳）の税金内訳 ──────────────┐
│                                              │
│  取り崩し額        3,000,000円               │
│  ─────────────────────────────               │
│  所得税                    0円  ← NISA非課税  │
│  住民税                5,000円               │
│  社会保険料          284,000円               │
│    国民健康保険      (85,000円)              │
│    国民年金         (199,000円)              │
│  取り崩し税               0円  ← NISA先行    │
│  ─────────────────────────────               │
│  税・社保合計        289,000円               │
│  実効負担率              9.6%               │
│                                              │
│  💡 NISA口座からの取り崩しにより            │
│     取り崩し税はゼロです                     │
└──────────────────────────────────────────────┘

┌─ 退職10年目（60歳）の税金内訳 ─────────────┐
│                                              │
│  取り崩し額        3,000,000円               │
│  ─────────────────────────────               │
│  所得税               45,000円               │
│  住民税               62,000円               │
│  社会保険料          312,000円               │
│  取り崩し税          127,000円  ← 特定口座    │
│  ─────────────────────────────               │
│  税・社保合計        546,000円               │
│  実効負担率             18.2%               │
│                                              │
│  💡 NISA枯渇後、特定口座の含み益に          │
│     20.315%の譲渡益税がかかっています        │
└──────────────────────────────────────────────┘
```

#### 結果画面全体に「税・社保反映済み」バッジ

成功確率の直下に小さなバッジを追加（コスト0で信頼性が上がる）：

```
FIRE成功確率: 67%
████████████████░░░░░░░░
🏛️ 2026年度 税制・社会保険料 反映済み
```

### 4. p50試行の特定方法

全試行のうち、最終資産がp50に最も近い試行を「代表試行」として選択し、その年次データから税金内訳を取得する。

```typescript
function findMedianTrial(trials: TrialResult[]): TrialResult {
  const sorted = [...trials].sort((a, b) => a.finalAssets - b.finalAssets);
  return sorted[Math.floor(sorted.length / 2)];
}
```

### 5. インサイトテキストの自動生成

各カードの下部に、税金構造の特徴を簡潔に説明するテキストを自動生成する。

| 条件 | テキスト |
|------|---------|
| NISA取り崩し中 | 「NISA口座からの取り崩しにより取り崩し税はゼロです」 |
| 特定口座取り崩し中 | 「特定口座の含み益に20.315%の譲渡益税がかかっています」 |
| iDeCo取り崩し中 | 「iDeCo一括受取に退職所得控除が適用されています」 |
| 社保が大部分 | 「税負担の大部分は社会保険料です」 |
| 実効負担率 < 10% | 「税効率の良い取り崩し戦略です」 |

## 技術的考慮事項

### エンジン変更の影響範囲

| ファイル | 変更内容 | リスク |
|---------|---------|--------|
| `simulation/types.ts` | `TaxBreakdown` 型追加、`YearResult.tax` → `taxBreakdown` | **中**: 既存の `tax` 参照をすべて変更 |
| `simulation/engine.ts` | `runTrial()` で内訳を保持 | **低**: ロジック変更なし |
| `components/results.tsx` | `tax` → `taxBreakdown.total` に変更 | **低**: 機械的置換 |
| `prescription/engine.ts` | `runSimulationLite()` は `TaxBreakdown` 不要（成功率のみ） | **なし** |
| テスト | `YearResult.tax` を参照するテストを更新 | **低** |

### メモリ影響

`TaxBreakdown` は `tax: number` (8 bytes) → 5つの number (40 bytes) に増加。
1,000試行 × 40年 × 40 bytes = ~1.6MB 増加。許容範囲内。

### 新規コード

| ファイル | 内容 | 推定行数 |
|---------|------|---------|
| `simulation/types.ts` | `TaxBreakdown` 型追加 | ~10行 |
| `simulation/engine.ts` | `runTrial()` 内訳保持 | ~20行変更 |
| `components/tax-breakdown-card.tsx` | 税金内訳カード | ~120行 |
| `components/results.tsx` | タブ追加 + バッジ | ~30行変更 |
| テスト更新 | 既存テストの `tax` → `taxBreakdown.total` | ~20行変更 |

**合計**: ~130行の新規コード + ~70行の変更

## 成功指標

| 指標 | 目標 |
|------|------|
| 結果画面を見て「税金入ってるんだっけ？」と思わない | 主観的に達成 |
| 退職1年目の所得税・住民税・社保の具体的な金額が見える | 数値が表示される |
| 退職10年目の税構造の変化（NISA枯渇→特定口座の課税）が理解できる | インサイトテキストで説明 |
| 実効負担率が1つの数字でわかる | % 表示 |
| 既存テストが全件パス（型変更による破壊なし） | `npm test` green |

## エッジケース

| # | ケース | 対処 |
|---|--------|------|
| 1 | 退職年齢が現在年齢と同じ（即退職） | 「退職1年目」は currentAge |
| 2 | endAge - retirementAge < 10 | 「退職10年目」の代わりに最終年を使う |
| 3 | 全口座残高ゼロで取り崩し不要の年 | 「この年は取り崩しなし」表示 |
| 4 | p50試行で資産が枯渇済み | 枯渇前の最後の年を表示 + 警告 |

## スコープ外（Sprint 6）

- 年次スライダーで任意の年を選択
- p25/p75の税金内訳比較
- 税引前 vs 税引後のチャート2本線表示
- 国保の内訳（医療・支援・介護）の3行展開
- 税金の経年推移グラフ

## 工数見積もり

| タスク | 工数 |
|--------|------|
| `TaxBreakdown` 型追加 + エンジン改修 | 1-2時間 |
| 既存テスト更新 + 新規テスト | 1時間 |
| 税金ブレイクダウンカード UI | 2-3時間 |
| Results統合 + バッジ追加 | 1時間 |
| インサイトテキスト生成 | 0.5-1時間 |
| **合計** | **5.5-8時間** |

## ハンドオフ

- `/plan-eng-review` — `TaxBreakdown` 型変更の影響範囲、後方互換の判断
- `/plan-design-review` — ブレイクダウンカードのUI/UXレビュー
- `/autoplan` — 全レビューを一括で走らせる
- 直接実装に進む場合は「税金の見える化を実装して」と指示

---

# ポートフォリオ・ブリッジ デザインドキュメント

> **ステータス**: Superseded by 統合資産台帳（Unified Asset Ledger）
> **スプリント**: Sprint 7
> **前提**: v0.3.0 (処方箋 + 税金の見える化) が完成済み

## 概要

資産クラス別の保有額を入力すると、合成リターン・リスクを相関行列で自動計算し、シミュレーションに反映する。「全員同じ初期値7%/15%」から「私のポートフォリオの成功確率」に変える。

**日本のFIREツールで、保有額ベースのポートフォリオからリスク・リターンを自動計算するものは存在しない。**

## 問題

現在のFIRE参謀は、ウィザードのステップ3で期待リターン（%）とリスク（%）をスライダーで手動入力する。実際にはユーザーは：

1. **自分のポートフォリオの合成リスク・リターンがわからない**ので初期値（7%/15%）をそのまま使う
2. myindex.jpは理論的な割合ベースのみで、**保有額からの入力ができない**
3. 証券会社アプリは保有額は見えるが**合成リスク・リターンを出さない**
4. 他のツールはメンテナンスされていない

結果として「自分の」FIREシミュレーションのはずが、全員同じ値で計算している。

## ターゲットユーザー

NISA/iDeCo/特定口座で複数ファンドを運用中の30-45歳ITエンジニア。ポートフォリオは「eMAXIS Slim全世界 + 先進国債券 + 国内REIT」のようにバラバラだが、合成リスク・リターンを自分で計算する知識/時間がない。

## 提案するアプローチ

### 1. 8資産クラスの定義

日本の個人投資家が使う主要8クラス（myindex.jp・GPIFの分類に準拠）：

| # | 資産クラス | 代表指数 |
|---|-----------|---------|
| 1 | 国内株式 | TOPIX |
| 2 | 先進国株式 | MSCI Kokusai |
| 3 | 新興国株式 | MSCI Emerging |
| 4 | 国内債券 | NOMURA-BPI |
| 5 | 先進国債券 | FTSE WGBI ex Japan |
| 6 | 新興国債券 | JPM EMBI+ |
| 7 | 国内REIT | 東証REIT指数 |
| 8 | 先進国REIT | S&P先進国REIT指数 |

\+ **現金・預金**（リターン0%、リスク0%）

### 2. 内蔵データテーブル

各資産クラスの過去20年（2006-2025年度）の年率リターン・リスクと相関行列を内蔵する。

#### 期待リターン・リスク（参考値、実装時に検証）

| 資産クラス | 期待リターン | リスク(標準偏差) |
|-----------|------------|----------------|
| 国内株式 | 8.0% | 18.0% |
| 先進国株式 | 9.0% | 19.5% |
| 新興国株式 | 7.5% | 24.0% |
| 国内債券 | 1.0% | 2.5% |
| 先進国債券 | 3.5% | 10.5% |
| 新興国債券 | 5.5% | 13.0% |
| 国内REIT | 7.5% | 19.0% |
| 先進国REIT | 8.5% | 21.0% |
| 現金・預金 | 0.0% | 0.0% |

**出典**: GPIF基本ポートフォリオ策定資料・myindex.jp公開データをベースに近似。JSONファイルにバージョン・出典・期間を明記する。

#### 相関行列（8×8）

内蔵JSONに格納。代表的な構造（簡略）：
- 国内株式 × 先進国株式: ~0.7
- 株式 × 債券: ~-0.1〜0.3
- 株式 × REIT: ~0.4〜0.6

**相関を無視して加重平均するとリスクを過大評価する。** 分散効果を反映するために相関行列は必須。

### 3. 合成リターン・リスクの計算

```typescript
interface AssetClassAllocation {
  assetClass: AssetClassId;
  amount: number; // 保有額（円）
}

// 合成期待リターン（加重平均）
function calcPortfolioReturn(allocs: AssetClassAllocation[]): number {
  const total = allocs.reduce((s, a) => s + a.amount, 0);
  return allocs.reduce((s, a) => {
    const weight = a.amount / total;
    return s + weight * ASSET_DATA[a.assetClass].expectedReturn;
  }, 0);
}

// 合成リスク（相関行列を使ったポートフォリオの標準偏差）
// σ_p = sqrt(Σ_i Σ_j w_i * w_j * σ_i * σ_j * ρ_ij)
function calcPortfolioRisk(allocs: AssetClassAllocation[]): number {
  const total = allocs.reduce((s, a) => s + a.amount, 0);
  let variance = 0;
  for (const a of allocs) {
    for (const b of allocs) {
      const wi = a.amount / total;
      const wj = b.amount / total;
      const si = ASSET_DATA[a.assetClass].risk;
      const sj = ASSET_DATA[b.assetClass].risk;
      const rho = CORRELATION[a.assetClass][b.assetClass];
      variance += wi * wj * si * sj * rho;
    }
  }
  return Math.sqrt(variance);
}
```

### 4. UI設計

#### ウィザード ステップ3 の2モード切り替え

```
┌──────────────────────────────────────────────┐
│ 投資条件                                      │
│                                              │
│ [◉ ポートフォリオ入力] [○ 手動入力]           │
│                                              │
│ ── ポートフォリオ入力モード ──                │
│                                              │
│ 資産クラス          保有額                    │
│ ┌───────────────────────────────────┐        │
│ │ 先進国株式          8,000,000 円  │        │
│ │ 新興国株式          2,000,000 円  │        │
│ │ 国内債券            3,000,000 円  │        │
│ │ 先進国REIT          1,000,000 円  │        │
│ │ + 資産クラスを追加                │        │
│ └───────────────────────────────────┘        │
│                                              │
│ 📊 合成リターン: 7.2%  リスク: 14.8%         │
│    分散効果: -3.2%（単純加重比）              │
│                                              │
│ 出典: GPIF第5期基本ポートフォリオ策定資料     │
│       過去20年(2006-2025年度) 年率換算        │
└──────────────────────────────────────────────┘
```

ポイント：
- **手動入力モード**は既存のスライダーをそのまま保持（上級者向け）
- **ポートフォリオ入力モード**がデフォルト
- 資産クラスはドロップダウンで選択 + 保有額を入力
- 不要な資産クラスは追加しない（0円の行は作らない）
- 合成値はリアルタイムで計算・表示
- **分散効果**を明示（「相関を考慮すると、リスクが単純加重より○%低い」）

#### 合成値の自動反映

ポートフォリオ入力モードで計算された合成リターン・リスクは、`FormState.expectedReturn` と `FormState.standardDeviation` に自動設定される。What-ifスライダーでも確認可能。

### 5. データファイル構造

```
src/config/
  tax-config-2026.json          # 既存
  asset-class-data.json         # 新規
```

```json
{
  "version": "1.0.0",
  "source": "GPIF第5期基本ポートフォリオ策定資料・各指数過去実績",
  "period": "2006-2025年度（20年間）",
  "lastUpdated": "2026-04-11",
  "assetClasses": {
    "domestic_stock": { "label": "国内株式", "expectedReturn": 0.08, "risk": 0.18 },
    "developed_stock": { "label": "先進国株式", "expectedReturn": 0.09, "risk": 0.195 },
    "...": "..."
  },
  "correlationMatrix": [
    [1.00, 0.70, 0.65, -0.10, 0.05, 0.15, 0.40, 0.35],
    "..."
  ]
}
```

### 6. FormState の拡張

```typescript
interface PortfolioEntry {
  assetClass: AssetClassId;
  amount: number;
}

interface FormState {
  // 既存フィールド（全て維持）
  currentAge: number;
  retirementAge: number;
  // ...
  expectedReturn: number;      // ← ポートフォリオ入力モード時は自動計算
  standardDeviation: number;   // ← 同上

  // 新規フィールド
  inputMode: "portfolio" | "manual";
  portfolio: PortfolioEntry[];
}
```

**既存の `expectedReturn` / `standardDeviation` を上書きする**設計。エンジン側の変更はゼロ。

## 技術的考慮事項

### ゼロ・エンジン変更の原則

`SimulationInput.allocation` は `{ expectedReturn, standardDeviation }` のまま。ポートフォリオ → 合成値の変換は `formToSimulationInput()` の手前で行う。シミュレーションエンジン、処方箋エンジン、Worker、税制エンジンは一切変更しない。

### 影響範囲

| ファイル | 変更内容 | リスク |
|---------|---------|--------|
| `src/config/asset-class-data.json` | 新規作成 | なし |
| `src/lib/portfolio/engine.ts` | 合成計算ロジック | **低**: 純粋関数 |
| `src/lib/portfolio/types.ts` | 型定義 | なし |
| `src/lib/form-state.ts` | `FormState` 拡張 + `portfolio` → `allocation` 変換 | **中**: 既存テストに影響 |
| `src/components/wizard.tsx` | ステップ3の2モード切り替え | **中**: UI変更 |
| テスト | portfolio engine テスト新規 + form-state テスト追加 | なし |

### 新規コード

| ファイル | 内容 | 推定行数 |
|---------|------|---------|
| `src/config/asset-class-data.json` | 8資産クラス + 相関行列 | ~80行 |
| `src/lib/portfolio/engine.ts` | 合成リターン・リスク計算 | ~60行 |
| `src/lib/portfolio/types.ts` | 型定義 | ~30行 |
| `src/lib/portfolio/engine.test.ts` | テスト | ~80行 |
| `src/components/wizard.tsx` | ステップ3の2モードUI | ~100行変更 |
| `src/lib/form-state.ts` | FormState拡張 | ~30行変更 |

**合計**: ~250行の新規コード + ~130行の変更

### 相関行列の検証

合成リスク計算の正しさは以下で検証：
- **単一資産100%**: 合成リスク = その資産のリスク
- **2資産50/50、相関1.0**: 合成リスク = 加重平均
- **2資産50/50、相関-1.0**: 合成リスク ≈ 0（完全ヘッジ）
- **GPIF基本ポートフォリオ（25%×4）**: GPIF公表値と±1%以内

## 成功指標

| 指標 | 目標 |
|------|------|
| ウィザードのリターン/リスクスライダーを手動で触る必要がない | ポートフォリオ入力モードで自動設定 |
| 自分のリアルなポートフォリオの合成値が出る | 合成リターン・リスクが保有額に応じて変動 |
| 合成値が「腹落ち」する | 分散効果の表示 + 出典バッジ |
| 既存テストが全件パス | `npm test` green |
| GPIF基本ポートフォリオ（25%×4）で公表値と±1%以内 | テストで検証 |

## エッジケース

| # | ケース | 対処 |
|---|--------|------|
| 1 | 全額1つの資産クラス | 合成値 = その資産クラスの値 |
| 2 | 保有額が全て0円 | ポートフォリオ入力モードでは計算できない旨を表示 |
| 3 | 手動モードに切り替え後、ポートフォリオモードに戻る | ポートフォリオの入力は保持 |
| 4 | 現金・預金100% | リターン0%、リスク0% → 成功率が極端に低い |
| 5 | 口座残高合計とポートフォリオ合計が不一致 | ポートフォリオの合成比率のみ使用し、残高は口座入力に従う |

## スコープ外（Sprint 7）

- 口座別（NISA/特定/iDeCo）のポートフォリオ管理
- バランスファンドのプリセット分解
- リバランス処方箋
- ファンド名の検索・個別ファンドの自動分類
- 相関行列の期間選択（10年/20年/30年）
- ポートフォリオの保存・読み込み

## 工数見積もり

| タスク | 工数 |
|--------|------|
| 資産クラスデータJSON作成・検証 | 2-3時間 |
| portfolio engine（合成計算） | 1-2時間 |
| テスト（GPIF検証含む） | 1-2時間 |
| FormState拡張 + 変換ロジック | 1-2時間 |
| ウィザードUI（2モード切り替え） | 3-4時間 |
| **合計** | **8-13時間** |

## ハンドオフ

- `/plan-eng-review` — 相関行列の精度・合成計算のアルゴリズム確認
- `/plan-design-review` — 2モードUIの切り替え体験レビュー
- `/autoplan` — 全レビューを一括で走らせる
- 直接実装に進む場合は「ポートフォリオ・ブリッジを実装して」と指示

---

# 統合資産台帳（Unified Asset Ledger）デザインドキュメント

> **ステータス**: Reviewed — /plan-eng-review APPROVE(条件付き) + /plan-design-review 7.6/10
> **スプリント**: Sprint 7（ポートフォリオ・ブリッジを置換）
> **前提**: v0.3.0 (処方箋 + 税金の見える化) が完成済み

## 概要

ウィザード3画面（基本情報 / 口座残高 / 投資条件）を**1画面のスクロールフォーム**（`max-w-4xl`）に統合し、ポートフォリオ行に課税種別を持たせることで「口座残高入力」と「ポートフォリオ入力」を**単一のテーブル**にする。金（ゴールド）資産クラスと長期譲渡所得税制を追加。

**入力は1回、計算は全部やる。**

## 問題

1. **入力の二重構造**: ウィザードのステップ2で口座残高（NISA/特定/iDeCo）を入力し、ステップ3でポートフォリオ（資産クラス別の保有額）を入力する。同じ資産なのに2回入力する。口座残高はポートフォリオの課税種別集計に過ぎないのに、別概念として扱っている。
2. **3画面は不要**: PCモニターで利用しているため、ウィザードの段階的入力は不要。1画面でスクロールするほうが速い。
3. **金（ゴールド）が無い**: 分散投資の一環として金現物（SBI証券）を保有しているが、8資産クラスに含まれず、シミュレーションから完全に消えている。

## ターゲットユーザー

**開発者本人（と家族）**。NISA/iDeCo/特定口座で複数ファンド + 金現物（SBI証券）を保有。マネーフォワードで資産を管理し、手動でFIRE参謀に転記している。汎用性は不要。

## 提案するアプローチ

### 1. ウィザード廃止 → 1画面スクロールフォーム

現在の4ステップウィザードを廃止し、`max-w-4xl`（896px）の1画面にすべてのセクションを配置する。結果画面と同じ横幅で、入力→結果の遷移で横幅のジャンプがない。

#### 資産テーブルのレイアウト: 2行構造

各ポートフォリオ行は、銘柄名を上段に小さいグレー文字で全幅表示し、下段に資産クラス(30%) / 課税種別(25%) / 金額(35%) + 削除(10%)の重みつき列を配置する。金額列は太字・右寄せ・`tabular-nums` で最重要フィールドとして視覚的に強調。

```
┌──────────────────────────────────────────────────────────┐
│ ── 基本情報 ──────────────────────────────────────────── │
│ 現在の年齢   [35]歳  退職[50]歳  終了[95]歳             │
│ 年収     [6,000,000]円  月間生活費  [250,000]円/月       │
│                                                          │
│ ── 資産 ───────────────────────────────────────────────  │
│                                                          │
│  eMAXIS Slim 米国株式(S&P500)                            │
│  [先進国株式 ▼]     [NISA ▼]        8,000,000 円    [✕] │
│                                                          │
│  eMAXIS Slim 全世界株式(オール・カントリー)               │
│  [先進国株式 ▼]     [特定口座 ▼]    5,000,000 円    [✕] │
│                                                          │
│  eMAXIS Slim 先進国債券インデックス                       │
│  [先進国債券 ▼]     [iDeCo ▼]      2,000,000 円    [✕] │
│                                                          │
│  SBI証券 金現物                                          │
│  [金 ▼]             [金現物 ▼]      3,000,000 円    [✕] │
│                                                          │
│  [+ 行を追加]                                            │
│                                                          │
│ ┌─ 集計 ──────────────────────────────────────────────┐ │
│ │ NISA 800万  特定 500万  iDeCo 200万  金現物 300万   │ │
│ │ 合計 1,800万                                        │ │
│ │                                                      │ │
│ │ 📊 合成リターン: 7.8%  リスク: 16.2%                │ │
│ │    分散効果: -2.8%（単純加重比）                     │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ── 詳細設定 ─────────────────────────────────────────── │
│ 特定口座の含み益率  [50]%                                │
│ iDeCoの加入年数    [15]年                                │
│ 金の含み益率       [30]%  ← 金がある場合のみ表示        │
│ シミュレーション回数 [1,000]回                            │
│                                                          │
│             [シミュレーション開始]                        │
└──────────────────────────────────────────────────────────┘
```

### 2. 課税種別（TaxCategory）の導入

「口座」と「課税方式」は別概念。NISA/特定/iDeCoは口座の種類だが、金現物は証券口座にあっても税制が異なる。将来の暗号資産（雑所得）やオプション取引（申告分離）にも対応できるよう、`TaxCategory` として設計する。

```typescript
// 現在出荷するもの
export const TAX_CATEGORIES = [
  "nisa",            // 非課税
  "tokutei",         // 源泉分離 20.315%
  "ideco",           // 退職所得控除
  "gold_physical",   // 総合課税（長期譲渡1/2 + 50万控除）
] as const;

export type TaxCategory = (typeof TAX_CATEGORIES)[number];

// 将来の拡張候補（スコープ外だが型設計で受け入れ可能）
// "crypto"        — 雑所得（総合課税）
// "options"       — 申告分離 20.315%（先物・オプション）
// "gold_etf"      — 特定口座の金ETF（20.315%、tokuteiと同じ）

// UIラベル
export const TAX_CATEGORY_LABELS: Record<TaxCategory, string> = {
  nisa: "NISA",
  tokutei: "特定口座",
  ideco: "iDeCo",
  gold_physical: "金現物",
};
```

### 3. PortfolioEntry の拡張

```typescript
// 現在
interface PortfolioEntry {
  assetClass: AssetClassId;
  amount: number;
}

// 変更後
interface PortfolioEntry {
  name?: string;               // 銘柄名（表示用・任意）
  assetClass: AssetClassId;
  taxCategory: TaxCategory;    // 課税種別
  amount: number;
}
```

### 4. 残高の自動集計

`FormState` から `nisaBalance` / `tokuteiBalance` / `idecoBalance` の直接入力を**廃止**。ポートフォリオ行の `taxCategory` で自動集計する。

```typescript
function deriveBalancesByTaxCategory(portfolio: PortfolioEntry[]): {
  nisa: number;
  tokutei: number;
  ideco: number;
  gold_physical: number;
} {
  const result = { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0 };
  for (const entry of portfolio) {
    if (entry.taxCategory in result) {
      result[entry.taxCategory] += entry.amount;
    }
  }
  return result;
}
```

### 5. 金（ゴールド）資産クラスの追加

#### asset-class-data.json に追加

| 項目 | 値 | 根拠 |
|------|---|------|
| 期待リターン | 6.5% | 円建て金価格の過去20年CAGR（参考値） |
| リスク | 19.0% | 円建て金価格の年率標準偏差 |

相関（主要クラスとの参考値）:
- 金 × 国内株式: 0.05
- 金 × 先進国株式: 0.05
- 金 × 新興国株式: 0.10
- 金 × 国内債券: 0.15
- 金 × 先進国債券: 0.25
- 金 × 新興国債券: 0.15
- 金 × 国内REIT: 0.05
- 金 × 先進国REIT: 0.05
- 金 × 現金: 0.00

**株式との相関がほぼゼロ** → 分散効果が大きい。これがポートフォリオに金を入れる理由であり、合成リスクに反映されないのは痛い。

#### AssetClassId の拡張

```typescript
export const ASSET_CLASS_IDS = [
  "domestic_stock",
  "developed_stock",
  "emerging_stock",
  "domestic_bond",
  "developed_bond",
  "emerging_bond",
  "domestic_reit",
  "developed_reit",
  "gold",        // ← 追加
  "cash",
] as const;
```

### 6. 金の税制: 長期譲渡所得

5年超の長期保有を前提とし、以下のルールを適用:

```
譲渡益 = 売却額 - 取得費
課税対象 = max(0, 譲渡益 - 500,000) × 0.5    // 50万円特別控除 + 1/2課税
→ 総合課税（所得税 + 住民税 + 復興特別所得税）
```

特定口座（源泉分離20.315%）とは異なり、**総合課税**なので他の所得と合算される。退職後は他の所得が少ないため、税率が低くなる傾向がある（FIRE的に有利）。

#### 税制エンジンの拡張

```typescript
/** 金現物（長期譲渡所得）の税額を計算 */
export function calcGoldWithdrawalTax(
  withdrawalAmount: number,
  gainRatio: number,    // 含み益率 (0-1)
  otherIncome: number,  // 他の総合課税所得（金の課税額に影響）
  age: number,
  cfg = config
): { tax: number; taxableIncome: number } {
  const gain = withdrawalAmount * gainRatio;
  const afterDeduction = Math.max(0, gain - 500_000); // 50万円特別控除
  const taxableIncome = afterDeduction * 0.5;          // 長期: 1/2課税

  // 総合課税: 他の所得と合算して累進課税
  const totalIncome = otherIncome + taxableIncome;
  const taxWithGold = calcIncomeTaxFromTaxableIncome(totalIncome, age, cfg);
  const taxWithoutGold = calcIncomeTaxFromTaxableIncome(otherIncome, age, cfg);
  const tax = taxWithGold - taxWithoutGold; // 差分が金に起因する税額

  return { tax, taxableIncome };
}
```

#### B1: `otherIncome` の設計決定（エンジニアリングレビューで追加）

`runTrial()` の取り崩しループ内で `otherIncome` をどう計算するか：

- 退職後の給与所得 = 0
- 特定口座は**源泉分離**（20.315%）→ 総合課税の `otherIncome` に含まない
- iDeCoは**退職所得**（分離課税）→ 総合課税の `otherIncome` に含まない
- NISAは非課税 → 含まない

**結論: `otherIncome = 0` を明示的なデフォルトとする。** 退職後にFIRE参謀が想定する取り崩しフェーズでは、金の前に総合課税所得が発生するケースは現モデルにない。コード内にこの前提をコメントで明記すること。

### 7. SimulationInput の拡張

```typescript
interface AccountBalance {
  nisa: number;
  tokutei: number;
  ideco: number;
  gold_physical: number;  // ← 追加
}

// withdrawalOrder にも gold_physical を追加
withdrawalOrder: TaxCategory[];
```

デフォルトの取り崩し順序: `["nisa", "tokutei", "gold_physical", "ideco"]`
- NISA: 非課税なので最初
- 特定: 源泉分離20.315%
- 金現物: 総合課税だが退職後は低税率（50万控除 + 1/2課税）
- iDeCo: 退職所得控除適用のため最後

### 8. FormState の変更

```typescript
interface FormState {
  // ── 基本情報（変更なし）──
  currentAge: number;
  retirementAge: number;
  endAge: number;
  annualSalary: number;
  monthlyExpense: number;

  // ── 廃止 ──
  // nisaBalance: number;       ← portfolio から自動集計
  // tokuteiBalance: number;    ← portfolio から自動集計
  // idecoBalance: number;      ← portfolio から自動集計
  // expectedReturn: number;    ← portfolio から自動計算
  // standardDeviation: number; ← portfolio から自動計算
  // inputMode: "portfolio" | "manual"; ← 廃止。常にポートフォリオ入力

  // ── 資産台帳（新） ──
  portfolio: PortfolioEntry[];  // 拡張版（name, taxCategory 追加）

  // ── 詳細設定（維持） ──
  idecoYearsOfService: number;
  tokuteiGainRatio: number;
  goldGainRatio: number;        // ← 追加: 金の含み益率
  numTrials: number;
}
```

### 9. formToSimulationInput() の変更

```typescript
export function formToSimulationInput(form: FormState): SimulationInput {
  // ポートフォリオから合成リターン・リスクを計算
  const portfolioResult = calcPortfolio(form.portfolio);
  const expectedReturn = portfolioResult.totalAmount > 0
    ? portfolioResult.expectedReturn
    : 0.05; // フォールバック
  const standardDeviation = portfolioResult.totalAmount > 0
    ? Math.max(0.001, portfolioResult.risk)
    : 0.15;

  // 残高を課税種別から自動集計
  const balances = deriveBalancesByTaxCategory(form.portfolio);

  return {
    currentAge: safeNum(form.currentAge, 35, 18),
    retirementAge: safeNum(form.retirementAge, 50, 19),
    endAge: safeNum(form.endAge, 95, 60),
    annualSalary: safeNum(form.annualSalary),
    annualExpense: safeNum(form.monthlyExpense) * 12,
    accounts: {
      nisa: balances.nisa,
      tokutei: balances.tokutei,
      ideco: balances.ideco,
      gold_physical: balances.gold_physical,
    },
    allocation: { expectedReturn, standardDeviation },
    idecoYearsOfService: safeNum(form.idecoYearsOfService, 20, 1),
    tokuteiGainRatio: safeNum(form.tokuteiGainRatio, 50) / 100,
    goldGainRatio: safeNum(form.goldGainRatio, 30) / 100,
    withdrawalOrder: ["nisa", "tokutei", "gold_physical", "ideco"],
    numTrials: safeNum(form.numTrials, 1000, 10),
    seed: Math.floor(Math.random() * 2 ** 32),
  };
}
```

## 技術的考慮事項

### 影響範囲

| ファイル | 変更内容 | リスク |
|---------|---------|--------|
| `portfolio/types.ts` | `PortfolioEntry` に `name`, `taxCategory` 追加。`gold` を `AssetClassId` に追加。`TaxCategory` 型定義 | **中**: 既存テスト更新 |
| `portfolio/engine.ts` | 変更なし（`calcPortfolio` は `assetClass` と `amount` のみ参照） | **なし** |
| `config/asset-class-data.json` | `gold` エントリ + 相関行列を10×10に拡張 | **低** |
| `lib/form-state.ts` | `FormState` 再設計。`nisaBalance` 等を廃止、`deriveBalancesByTaxCategory()` 追加 | **高**: 参照箇所が多い |
| `components/wizard.tsx` | 全面書き替え → 1画面フォーム（`max-w-4xl`） | **高**: UIの最大変更 |
| `simulation/types.ts` | `AccountBalance` に `gold_physical` 追加 | **中**: エンジン影響 |
| `simulation/engine.ts` | `runTrial()` に金口座の取り崩し + 税計算を追加 | **中** |
| `tax/engine.ts` | `calcGoldWithdrawalTax()` 追加 | **低**: 新規関数 |
| `tax/accounts.ts` | `TaxCategory` を使用、`calcWithdrawalTax()` に `gold_physical` ケース追加 | **中** |
| `withdrawal/optimizer.ts` | 4課税種別の取り崩し順序最適化（24通り） | **中** |
| `prescription/engine.ts` | `runTrialLite()` に金口座処理追加 | **中** |
| テスト全般 | `FormState` 変更に伴う更新 | **中** |

### 後方互換の方針

`nisaBalance` / `tokuteiBalance` / `idecoBalance` / `expectedReturn` / `standardDeviation` / `inputMode` を `FormState` から削除するのは破壊的変更。以下の方針で対処:

1. **一括削除** — ユーザーは1人（開発者本人）。後方互換を維持するコストが無駄。テストを更新して一括移行。
2. `formToSimulationInput()` が唯一の変換レイヤー。ここだけ正しければエンジン側は動く。

### B2: `runTrialLite()` の金口座対応（エンジニアリングレビューで追加）

`prescription/engine.ts` の `runTrialLite()` は `runTrial()` の軽量版だが別実装。口座の取り崩しロジックが `nisa/tokutei/ideco` にハードコードされている。金口座を追加しないと処方箋の成功率計算に金が反映されない。

**対処**: `runTrialLite()` に `getBalance()` と取り崩しの switch 文に `gold_physical` ケースを追加。`calcGoldWithdrawalTax()` の簡略版（`otherIncome = 0` 固定）を使う。

### B3: `TaxCategory` exhaustive switch（エンジニアリングレビューで追加）

`TaxCategory` 拡張時に switch 文の漏れを防ぐため、`never` パターンで exhaustive check を強制:

```typescript
function assertNever(x: never): never {
  throw new Error(`Unexpected tax category: ${x}`);
}
```

全 switch 文の `default` にこれを入れれば、TypeScript が `gold_physical` ケース漏れをコンパイルエラーにする。

変更が必要な switch 文の一覧:

| ファイル | 関数 |
|---------|------|
| `simulation/engine.ts` | `runTrial()` 内 switch, `getAccountBalance()` |
| `tax/accounts.ts` | `calcWithdrawalTax()` |
| `prescription/engine.ts` | `getBalance()`, `runTrialLite()` 内 switch |
| `withdrawal/optimizer.ts` | `ALL_WITHDRAWAL_ORDERS`, `orderLabel()` |

### 金の取り崩しモデル

シミュレーションエンジンの `runTrial()` に金口座を追加:

- 金は単独資産クラスとして成長（合成ポートフォリオの成長率ではなく、金固有のリターン・リスクで成長させるか、合成に含めるか → **合成に含める方式を採用**。理由: シンプル。全口座が同じ成長率で成長する現行モデルを維持）
- 取り崩し時: `calcGoldWithdrawalTax()` で長期譲渡所得を計算（`otherIncome = 0`）
- TaxBreakdown に `goldTax` フィールドを追加するか、`withdrawalTax` に合算するか → **`withdrawalTax` に合算**（Sprint 6の税金の見える化でインサイトテキストで区別可能）

### 取り崩し順序最適化の爆発

4課税種別で 4! = 24通りの総当たり。現在の 6通り（3口座）の4倍。100試行×24 = 2,400回のシミュレーション。PCのみ利用なら許容範囲。速度が問題になる場合は、金現物の固定位置（NISA→特定→**金現物**→iDeCo）の仮定で探索空間を 3! × 2 = 12通りに削減できる。

### UI設計の決定事項（デザインレビューで確定）

| 項目 | 決定 |
|------|------|
| 情報アーキテクチャ | インラインサマリー（テーブル直下に `bg-muted` パネル） |
| ビジュアル階層 | 重みつき列: 資産クラス(30%) / 課税種別(25%) / 金額(35%) + 削除(10%)。銘柄名は上段に小さいグレー文字 |
| インタラクション | ミニマル: `useMemo` + ボタン無効化。アニメーションなし。既存wizard.tsxパターン踏襲 |
| アクセシビリティ | 実用最低限: 各入力に `aria-label`、削除ボタンに `aria-label="削除"` |
| レスポンシブネス | `max-w-4xl`（結果画面と統一）。モバイル対応はスコープ外 |
| 一貫性 | 素の `<select>` + shadcn風CSSスタイリング。カスタムポップオーバーは不使用 |
| セレクトボックス | 素の HTML `<select>` を Tailwind class で shadcn 風にスタイリング |

### 新規コード

| ファイル | 内容 | 推定行数 |
|---------|------|---------|
| `config/asset-class-data.json` | `gold` エントリ + 相関行列10×10 | ~15行追加 |
| `portfolio/types.ts` | `TaxCategory`, `PortfolioEntry` 拡張, `gold` 追加 | ~20行変更 |
| `lib/form-state.ts` | `FormState` 再設計 + `deriveBalancesByTaxCategory()` | ~60行変更 |
| `tax/engine.ts` | `calcGoldWithdrawalTax()` | ~25行追加 |
| `tax/accounts.ts` | `TaxCategory` 拡張 + `gold_physical` ケース | ~15行変更 |
| `simulation/types.ts` | `AccountBalance` に `gold_physical`, `SimulationInput` に `goldGainRatio` | ~5行変更 |
| `simulation/engine.ts` | `runTrial()` に金口座処理 + exhaustive switch | ~35行変更 |
| `prescription/engine.ts` | `runTrialLite()` に金口座処理 | ~25行変更 |
| `withdrawal/optimizer.ts` | 4課税種別対応（24通り） | ~20行変更 |
| `components/wizard.tsx` | 1画面フォームに全面書き替え（2行レイアウト） | ~280行（差分） |
| テスト更新 | form-state, simulation, tax, prescription のテスト更新 + 新規 | ~100行変更 |

**合計**: ~340行の新規コード + ~260行の変更

## 成功指標

| 指標 | 目標 |
|------|------|
| 入力が1画面で完結する | ウィザードのステップ遷移がゼロ |
| 残高がポートフォリオの合計値と自動一致する | `deriveBalancesByTaxCategory()` の出力 = 旧 `nisaBalance` 等の役割 |
| 金現物がシミュレーションに反映される | 金を含むポートフォリオで成功率が変動する |
| 金の取り崩し時に長期譲渡所得（1/2課税 + 50万控除）が適用される | テストで検証 |
| 入力時間が大幅短縮される | 10分 → 目標3分以内 |
| 既存テストが全件パス | `npm test` green |

## エッジケース

| # | ケース | 対処 |
|---|--------|------|
| 1 | ポートフォリオが空（行ゼロ） | 「資産を1行以上追加してください」バリデーション |
| 2 | 全行の金額が0円 | 合成リターン・リスク = フォールバック値（5%/15%）、残高 = 全てゼロ |
| 3 | 同じ資産クラスが異なる課税種別に存在 | 正常。合成計算は `assetClass` × `amount` で集計、残高は `taxCategory` で集計 |
| 4 | 金のみ保有（他の課税種別ゼロ） | NISA/特定/iDeCo = 0、金現物のみで取り崩しシミュレーション |
| 5 | 金の含み益率が100%に近い | 正常。全額が譲渡益として計算される |
| 6 | 金の譲渡益が50万円以下 | 50万円特別控除で課税所得0。`max(0, gain - 500,000) * 0.5` = 0 |
| 7 | 処方箋エンジンに金口座を含む入力 | `runTrialLite()` が金口座に対応していること（B2で対処済み） |
| 8 | 最後の1行を削除しようとする | 削除不可（✕ボタン非表示）。最低1行は必須 |

## スコープ外（Sprint 7）

- CSVインポート（マネーフォワードも証券会社も今は対象外）
- 銘柄名からの資産カテゴリ自動推定
- ポートフォリオの保存・復元（localStorageは将来検討）
- 課税種別と資産クラスの組み合わせバリデーション
- 金以外のコモディティ（銀・プラチナ等）
- 短期譲渡所得（5年以内の金売却）
- 暗号資産（雑所得・総合課税）
- オプション取引（申告分離 20.315%）
- モバイル対応

## 工数見積もり

| タスク | 工数 |
|--------|------|
| `asset-class-data.json` に金追加 + 相関行列10×10 | 1時間 |
| `TaxCategory` / `PortfolioEntry` / `FormState` 型変更 + `deriveBalancesByTaxCategory()` | 2-3時間 |
| `calcGoldWithdrawalTax()` + 税制エンジン拡張 + exhaustive switch | 1-2時間 |
| シミュレーションエンジン（金口座 + 取り崩し）+ `runTrialLite()` 対応 | 2-3時間 |
| 1画面フォームUI（wizard.tsx 全面書き替え、2行レイアウト） | 3-4時間 |
| テスト更新 + 新規テスト（P0: 13件 + P1: 6件） | 2-3時間 |
| **合計** | **11-16時間** |

## ハンドオフ

- 直接実装に進む場合は「統合資産台帳を実装して」と指示
