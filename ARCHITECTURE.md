# FIRE参謀 — アーキテクチャ

> **バージョン**: v4.6.7（368 ユニットテスト + 9 E2E）
> **ライブ**: https://akiyoshi.github.io/fire-sanbo/

ナビゲーション: [README](README.md) · [DESIGN](DESIGN.md) · **ARCHITECTURE** · [TODOS](TODOS.md) · [Archive](docs/archive/)

このドキュメントは **「現在どう動いているか」** を記述します（Diataxis: Reference）。採用理由は [DESIGN.md](DESIGN.md)、未着手の改善案は [TODOS.md](TODOS.md) を参照してください。

---

## 1. 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Vite 6 + React 19（SPA、SSR/RSCなし） |
| スタイル | Tailwind CSS v4 + shadcn/ui (base-nova / OKLCHトークン) |
| アイコン | lucide-react（SVG） |
| 計算 | Web Worker（モンテカルロをオフスレッド実行） |
| 言語 | TypeScript 5（strict、bundler moduleResolution） |
| テスト | Vitest 368ユニット + Playwright 9 E2E |
| 品質 | ESLint 9 + typescript-eslint + eslint-plugin-react-hooks 7 |
| CI/CD | GitHub Actions → GitHub Pages（全アクション SHA-pinned） |

---

## 2. ルーティング — ステートマシン（外部ルーター不使用）

[src/App.tsx](src/App.tsx) は 6 フェーズのステートマシン + React.lazy + ChunkErrorBoundary で構成されます。

```typescript
type AppState =
  | { phase: "guide" }
  | { phase: "input" }
  | { phase: "calculating"; form: FormState }
  | { phase: "result"; form: FormState; result: SimulationResult }
  | { phase: "compare" }
  | { phase: "methodology" };
```

- `guide`: はじめにガイド（チュートリアル）
- `input`: ウィザードフォーム
- `calculating`: SimulationWorker 実行中のローディング
- `result`: 結果画面（What-if 再計算、シナリオ保存）
- `compare`: シナリオ比較
- `methodology`: 計算根拠書（15 セクション・4 グループ）

遷移は `setState({ phase: ... })` のみ。URL ルーティングなし。Results / ScenarioCompare / MethodologyPage は React.lazy で遅延ロード（初期バンドル 49% 削減）、ChunkErrorBoundary がチャンク読み込み失敗をハンドルします。

共有 URL（`#s=...`）は起動時にフラグメントから FormState を復元し、自動的に `result` フェーズへ遷移します。

---

## 3. シミュレーションエンジン — 7 フェーズ年次ループ

[src/lib/simulation/engine.ts](src/lib/simulation/engine.ts) の `runTrial(input, rng: PRNG)` が `currentAge → endAge` の各年に対して以下を実行します。

| Phase | 名称 | 内容 |
|-------|------|------|
| 1 | 収入 | 現役中の給与 → `calcAnnualTax()` → 手取り。incomeTax / residentTax / socialInsurance を追跡 |
| 2 | 退職金 | `age === retirementAge` で `calcRetirementBonusNet(amount, yearsOfService)`、税引後手取りを特定口座（または cash）に投入 |
| 3 | 退職後収入 | `calcAnnualPension(pension, age)` + `calcSideIncomeTax(sideIncome.annualAmount)`。Primary + Spouse 合算、繰上げ -0.4%/月・繰下げ +0.7%/月（75 歳上限） |
| 4 | 支出・取り崩し | `totalNeeded = annualExpense + socialInsurance + lifeEventExpense - workerIncome - postRetirementIncome`。`withdrawalOrder` 順に Primary → Spouse から取り崩し、`calcWithdrawalTax(taxCategory, amount)` で課税 |
| 5 | 余剰積立 / 赤字取り崩し | 在職中の余剰は NISA（年間/生涯枠）→ 特定口座へ積立。退職前の赤字は `withdrawalOrder` で取り崩し |
| 6 | リターン | `realReturn = expectedReturn - inflationRate` を `generateLogNormalReturn()` で適用。口座別リターンが設定されていれば各口座個別。cash は無利子 |
| 7 | 集計 | 総資産・口座別残高・税負担を記録。`if (totalAssets <= 0 && anyRetired) depletionAge = age` |

**出力**: `TrialResult { years[], success, depletionAge, finalAssets }`。`numTrials` 回繰り返し → `runSimulation()` がパーセンタイル（p5 / p25 / p50 / p75 / p95）を算出。

### 共通ヘルパー

- [src/lib/simulation/helpers.ts](src/lib/simulation/helpers.ts): `MemberAccounts` インターフェース、`drawFromAccounts()`、`contributeSurplus()`、`calcAnnualPension()`、`calcLifeEventExpense()` を共有
- [src/lib/simulation/cost-basis.ts](src/lib/simulation/cost-basis.ts): `CostBasis` クラス（`gainRatio(balance)` / `contribute(amount)` / `withdraw(amount, balance)`）
- [src/lib/simulation/member-withdrawal.ts](src/lib/simulation/member-withdrawal.ts): 退職後の課税考慮取り崩し共通関数（`prescription/engine` でも使用）
- [src/lib/simulation/diagnosis.ts](src/lib/simulation/diagnosis.ts): p5 失敗シナリオを 4 分類（暴落型 / 資金不足型 / ライフイベント集中型 / 長寿リスク型）

### 含み益動的追跡（v4.5.1）

特定口座・金現物の取得費を `CostBasis` クラスで年次追跡し、`gainRatio = 1 - costBasis / balance` を毎年再計算します。積立は `contribute(amount)`、取り崩し・売却は按分減少、退職金税引後手取りは全額 `costBasis` に加算。これにより従来の静的 `gainRatio` 初期値固定を廃止しました。

### 口座別リターン + リバランス（v4.2 / v4.3）

各口座の資産クラス構成から個別の期待リターン・リスクを導出し、口座ごとに異なるリターンを適用します。資産クラスレベルの `targetAllocation` を入力すると、積立時は最も不足している口座に優先配分、退職後は乖離閾値（デフォルト 5%）超過時に売買を実行（特定口座は 20.315% 譲渡益課税を反映）。後方互換: `accountAllocations` / `rebalance` 未設定時は全口座同一リターン。

---

## 4. 税エンジン — 23 関数

[src/lib/tax/engine.ts](src/lib/tax/engine.ts) は 2026 年度税制（[src/config/tax-config-2026.json](src/config/tax-config-2026.json)）を参照する純関数群です。年度切替は [src/config/tax-config-index.ts](src/config/tax-config-index.ts) の `getTaxConfig(year)` で抽象化されており、新年度 JSON を追加するだけで対応できます。

### 給与・所得税

- `calcEmploymentIncomeDeduction(salary)` / `calcEmploymentIncome(salary)`
- `calcBasicDeduction(totalIncome)` / `calcResidentBasicDeduction(totalIncome)`
- `calcTaxableIncome(totalIncome, socialInsuranceDeduction)`
- `calcIncomeTax(taxableIncome)` — 累進ブラケット + 復興特別所得税 2.1%
- `calcMarginalIncomeTaxRate(taxableIncome)` — ブラケット税率（v4.6.1）
- `calcResidentTax(totalIncome, socialInsuranceDeduction)` — 所得割 + 均等割

### 社会保険料

- `calcSocialInsurancePremium(totalIncome, age)` — NHI（医療 2.79% + 支援 0.68%）+ 介護（40–64 歳）+ 厚生年金（≤59 歳）。65 歳以上は Category 1 固定額

### 退職金・取り崩し

- `calcRetirementIncomeDeduction(yearsOfService)` — 40 万 × years（≤20 年）+ 70 万 ×（years−20）
- `calcRetirementTaxableIncome(lumpSum, yearsOfService)` — `floor((lumpSum - deduction) * 0.5)`
- `calcRetirementBonusNet(amount, yearsOfService)` → `{ net, tax }`
- `calcEffectiveYearsForLumpSum(firstAge, firstYears, secondAge, secondYears, ruleYears)` — 退職所得控除の重複期間ルール（5/19 年、年単位近似、v4.6.3）
- `calcCombinedLumpSumNet(ideco, bonus)` — iDeCo 一時金 + 退職金の合算手取り。受給順序を自動判定（v4.6.3）
- `findOptimalIdecoLumpSumAge(ideco, bonus, range=60-75)` — 最適 receiveAge を離散探索（v4.6.3）
- `calcTokuteiTax(gain)` → 20.315%
- `calcNisaTax(gain)` → 0
- `calcGoldWithdrawalTax(withdrawal, gainRatio, otherIncome)` — 50 万特別控除 + 1/2 課税（長期）

### 年金・副収入

- `calcPublicPensionDeduction(pensionIncome, age)` — 65 歳未満 / 以上で異なる累進控除
- `calcComprehensiveTax(pensionTaxable, sideIncome, socialInsuranceDeduction)` → `{ incomeTax, residentTax, total }`

### ふるさと納税

- `calcFurusatoLimit(taxableIncome, marginalRate)` — 自己負担 2,000 円で済む年間寄附上限（総務省ポータル準拠、v4.6.1）

### 統合

- `calcAnnualTax(salary, age)` → `{ employmentIncome, socialInsurance, incomeTax, residentTax, totalTax, netIncome, taxableIncome, marginalIncomeTaxRate }`（後者 2 フィールドは v4.6.1 で追加 — `calcFurusatoLimit` が呼び出し側で再計算せず利用するため）
- `calcWithdrawalTax(taxCategory, amount, options)` → `WithdrawalResult { gross, tax, net, taxCategory }`（NISA / tokutei / ideco / gold / cash にディスパッチ）

---

## 5. ポートフォリオエンジン

[src/lib/portfolio/engine.ts](src/lib/portfolio/engine.ts) — `calcPortfolio(entries)` → `{ expectedReturn, risk, weights, totalAmount }`

リターンは加重平均、リスクは共分散行列 √(Σ wᵢ wⱼ σᵢ σⱼ ρᵢⱼ)。相関行列は [src/config/asset-class-data.json](src/config/asset-class-data.json) から読み込み。

[src/lib/portfolio/optimizer.ts](src/lib/portfolio/optimizer.ts) — `optimizePortfolio(availableAssets, riskTolerance, numSamples, seed)` → `{ frontier[], recommended, minRisk, maxReturn }`

ディリクレ分布で 10,000 ポートフォリオをモンテカルロサンプリング → 効率的フロンティア抽出 → `riskTolerance` 0→1 で minRisk → maxReturn にマッピング。`selectByMode()` は安全化（reduce-risk）/効率化（increase-return）モードで現在ポートフォリオから推奨点を選択します。

---

## 6. 取り崩し最適化

[src/lib/withdrawal/optimizer.ts](src/lib/withdrawal/optimizer.ts) — `optimizeWithdrawalOrder(baseInput)` → `{ best, worst, all[], benefitAmount }`

cash 末尾固定 + 残り課税口座（NISA / tokutei / iDeCo / gold）の全順列（最大 4! = 24 通り）を評価。決定論的モード（中央値リターン `exp(log(1+r) - σ²/2) - 1`、ボラティリティドラッグ反映、<50ms 同期計算）で各順序の successRate / medianFinalAssets を比較。iDeCo は 60 歳未満は取り崩し対象から除外（確定拠出年金法準拠）。

---

## 7. 処方箋エンジン

[src/lib/prescription/engine.ts](src/lib/prescription/engine.ts) は `runTrialLite()` を内部に持ち、4 軸で目標成功率（デフォルト 90%）に届く調整値を二分探索 / フロンティア走査します。

| 軸 | 探索内容 |
|----|---------|
| 支出削減 | `annualExpense` を二分探索 |
| 退職延期 | `retirementAge` を二分探索（75 歳上限） |
| 収入増加 | `annualSalary` を二分探索（年収 +X 万円） |
| アロケーション | 効率的フロンティアを走査し「リスクを X% → Y% に調整」を提案、ワンクリック適用 |

各処方箋には難易度タグ（やさしい / ふつう / むずかしい）が付与され、最高インパクトのカードはアクセントボーダーで視覚的に強調されます。runTrialLite は `MemberAccounts` + 共通関数で書き直され（v4.5.5）、Spouse/Primary 重複と iDeCo 60 歳制約のバグが解消されています。

### SWR エンジン（v4.6.2）

[src/lib/swr/engine.ts](src/lib/swr/engine.ts) は `runSimulationLite()` への薄い委譲ファサードで、目標成功率（既定 90%）を満たす最大の年間支出を二分探索します。`prescription/engine.ts` の expense 軸と同じロジックですが、探索範囲を `max(現在支出 × 3, 月100万)` まで拡張するため、資産余裕ユーザーの真の SWR を返せます。

出力 `SWRResult` は `{ maxAnnualExpense, monthlyExpense, rate, vsBengen4Pct, targetRate, convergenceIterations }`。結果画面では成功率カード直下に「90% を維持できる月額支出: X 万円」をインライン表示します（autoplan AD-12）。

### iDeCo×退職金 受給年最適化（v4.6.3）

[src/lib/tax/engine.ts](src/lib/tax/engine.ts) の `findOptimalIdecoLumpSumAge()` は 60〜75 歳を離散探索し、`calcCombinedLumpSumNet()` の合計手取りが最大となる受給年齢を返します。シミュレーション全体は変えず、純粋に税最適化のみを提示するため軽量（< 1ms）。改善カードは iDeCo 残高 > 0 かつ retirementBonus > 0 のときだけ表示され、improvement > 10 万円の場合に「`{optimalAge}` 歳に遅らせると手取り +X 万円」と提案します。

---

## 8. 入力モデル — `SimulationInput`

[src/lib/simulation/types.ts](src/lib/simulation/types.ts)

```typescript
SimulationInput {
  // コア
  currentAge, retirementAge, endAge
  annualSalary, annualExpense
  accounts: { nisa, tokutei, ideco, gold_physical, cash }
  allocation: { expectedReturn, standardDeviation }

  // 税・取り崩し
  idecoYearsOfService, tokuteiGainRatio, goldGainRatio
  withdrawalOrder: ("nisa" | "tokutei" | "ideco" | "gold_physical" | "cash")[]

  // 実行制御
  numTrials, inflationRate, seed?, fiscalYear?

  // 拡張（オプショナル）
  pension?: { kosei, kokumin, startAge }
  retirementBonus?: { amount, yearsOfService }
  sideIncome?: { annualAmount, untilAge }
  lifeEvents?: [{ id, label, age, amount }]
  nisaConfig?: { annualLimit, lifetimeLimit }
  spouse?: SpouseInput
  accountAllocations?: AccountAllocations  // 口座別リターン
  targetAllocation?: TargetAllocation[]    // 目標配分
  rebalanceEnabled?: boolean
}
```

**出力**: `SimulationResult { successRate, trials, percentiles: { p5, p25, p50, p75, p95 }, ages }`

---

## 9. FormState 永続化

[src/lib/form/](src/lib/form/) は v4.5.7 で 5 ファイルに分割、v4.6.0 でマイグレーション基盤を追加：

| ファイル | 責務 |
|---------|------|
| `types.ts` | FormState v5 型定義 |
| `storage.ts` | localStorage 読み書き。`migrateForm()` 経由で旧バージョンを吸収 |
| `migrate.ts` | スキーマ版差マイグレーション基盤（v4.6.0）。`migrators[N]` への登録で v(N) → v(N+1) を連鎖適用。テスト用フック `__testing__` を `export` |
| `scenarios.ts` | 名前付きシナリオの保存・読込・一覧 |
| `io.ts` | JSON エクスポート / インポート、共有 URL から復元。`migrateForm()` 経由で旧バージョンも受理 |
| `derive.ts` | `formToSimulationInput()` / `spouseFormToInput()` — バリデーション・ガード適用 |

[src/lib/form-state.ts](src/lib/form-state.ts) はバレル再エクスポート（13 行）として残置、29 箇所のインポートパスは未変更です。

スキーマ進化:
- **v3**: ライフイベント・年金・退職金・副収入
- **v4**: `withdrawalOrder`
- **v5**: `targetAllocation` + `rebalanceEnabled`（現行）
- **v6 以降**: `migrate.ts` の `migrators[N]` に 1 行追加で対応

---

## 10. 共有 URL

[src/lib/url-share.ts](src/lib/url-share.ts) — pako の DeflateRaw + Base64url 圧縮で FormState を URL フラグメント `#s=...` に格納。サーバー不要、Web Share API + クリップボードフォールバック。

セキュリティ:
- 圧縮入力 50KB / 展開後 500KB 上限（decompression bomb 防御）
- `portfolio` ≤ 20 件、`lifeEvents` ≤ 30 件、`targetAllocation` ≤ 20 件
- `label` 最大 50 文字、`numTrials` 固定 1000
- `importFormFromJSON` で全フィールドにバリデーション

---

## 11. UI コンポーネント

```
src/components/
├── wizard.tsx              # オーケストレーター + CollapsibleCardセクション
├── wizard/
│   ├── shared.tsx          # NumberInput, SliderInput
│   ├── scenario-section    # シナリオ管理 + JSON エクスポート/インポート
│   ├── basic-section       # 年齢・年収・生活費 + 「すぐにシミュレーション」
│   ├── portfolio-section   # 資産入力 + 合成 + 最適化 + アロケーションバー
│   ├── income-section      # 年金・退職金・副収入
│   ├── events-section      # ライフイベント
│   └── advanced-section    # インフレ率・含み益率・試行回数
│   # 上記 6 セクションだけが wizard.tsx で import・レンダリングされています。
│   # spouse-section / template-selector / quick-start / quick-preview は
│   # ファイルとしては存在しますが現在未配線です（TODOS 参照）。
├── results.tsx             # 1軍(常時表示) + 2軍(折りたたみ) + What-if + シナリオ保存。SWR インライン併記 + iDeCo×退職金 改善カードを成功率カード直下に表示（v4.6.4）
├── guide-page.tsx          # はじめにガイド（チュートリアル）
├── prescription-card.tsx   # 処方箋
├── worst-case-card.tsx     # 最悪ケース診断書 + 退職前1年チェックリスト（住民税ショック現金枠 + ふるさと納税上限、v4.6.4）
├── withdrawal-card.tsx     # 取り崩し最適化UI
├── tax-breakdown-card.tsx  # 税負担の内訳
├── portfolio-optimizer.tsx # 効率的フロンティア（inline モード対応）
├── scenario-compare.tsx    # シナリオ比較
├── theme-toggle.tsx        # ダーク / ライト切替
├── methodology/            # 計算根拠書（18 セクション + IntersectionObserver 目次。v4.6.5 で 5/19年・SWR・ふるさと納税 を追加）
└── ui/                     # shadcn/ui
```

### 結果画面の情報階層

1 カラムレイアウト。1 軍は常時表示（成功率・最優先アクション・SWR インライン・iDeCo タイミング改善カード・資産推移チャート・What-if スライダー・最悪ケース診断書 / 退職準備チェックリスト）、2 軍は `<details>` で折りたたみ（処方箋・取り崩し最適化・アセットアロケーション最適化・税負担の内訳・ふるさと納税 上限の年次推移）。p5 vs 中央値の対比テーブルは重要年を間引き、暴落年・枯渇年をハイライトします。

---

## 12. テスト構成（v4.6.7 — 368 ユニット + 9 E2E）

| ファイル | テスト数 | 検証範囲 |
|---------|---------|---------|
| `simulation/engine.test.ts` | 66 | 成功率、パーセンタイル、インフレ、年金、配偶者、iDeCo、costBasis、リバランスエッジ、退職翌年住民税ショック (F-2/T-10)、ふるさと納税年次出力 (T-7)、退職年統合シナリオ |
| `form-state.test.ts` | 55 | 入力変換、ストレージ、シナリオ、年齢ガード、上限、DoS 対策 |
| `tax/engine.test.ts` | 43 | 全税計算、エッジケース、FIRE シナリオ |
| `tax/overlap.test.ts` | 28 | iDeCo×退職金 5/19 年ルール、重複期間境界、最適 receiveAge 探索（v4.6.3 新規） |
| `prescription/engine.test.ts` | 24 (+1 skipped) | 処方箋生成、難易度、収入軸、アロケーション軸、境界値、runTrial/runTrialLite drift 検出 |
| `portfolio/optimizer.test.ts` | 18 | フロンティア、ウェイト、リスク許容度、selectByMode |
| `url-share.test.ts` | 17 | 圧縮/展開、decompression bomb |
| `withdrawal/optimizer.test.ts` | 15 | 順列、ランキング、決定論モード、cash 除外、yearlyAssets |
| `simulation/cost-basis.test.ts` | 14 | CostBasis: 初期化、gainRatio、contribute、withdraw、含み損回復 |
| `tax/furusato.test.ts` | 13 | ふるさと納税上限、限界税率、ブラケット境界、denominator 安全弁（v4.6.1 新規） |
| `form/migrate.test.ts` | 10 | FormState 版差マイグレーション、identity / throw kill-switch / 連鎖 skip-1-step（v4.6.0 新規） |
| `portfolio/engine.test.ts` | 10 | ポートフォリオ合成、相関 |
| `simulation/helpers.test.ts` | 10 | drawFromAccounts、contributeSurplus |
| `scenario-templates.test.ts` | 10 | テンプレート適用、delta マージ |
| `swr/engine.test.ts` | 10 | SWR 自動算定、二分探索収束、prescription 委譲一致（v4.6.2 新規） |
| `simulation/member-withdrawal.test.ts` | 9 | 退職後課税考慮取り崩し |
| `simulation/diagnosis.test.ts` | 7 | p5 診断、失敗分類 |
| `tax-config-index.test.ts` | 4 | 年度切替 |
| `wizard.test.tsx` | 4 | Wizard UI コンポーネント |
| `prescription-card.test.tsx` | 1 | 処方箋カード UI |
| **合計** | **368** | + Playwright E2E 9（SWR サマリ / 退職準備 / ふるさと納税 details 含む） |

### テスト共通ユーティリティ

[src/lib/test-utils/](src/lib/test-utils/) にテスト専用のヘルパーを集約。テストファイルからのみ参照可、本番コードからの import は禁止。

- [fixtures.ts](src/lib/test-utils/fixtures.ts): `createSimulationInput`, `createMemberAccounts`, `createSpouseInput`, `createYearResult`, `createTrialResult`
- [assertions.ts](src/lib/test-utils/assertions.ts): `expectPercentilesOrdered`, `expectInRange`
- 命名規約と利用方針は [AGENTS.md](AGENTS.md) の「テストコード規約」を参照

---

## 13. セキュリティ

- **CSP**: [vite.config.ts](vite.config.ts) の `cspPlugin()` で本番ビルド時のみ `<meta>` タグを注入。`script-src 'self'` / `object-src 'none'` / `base-uri 'self'` / `form-action 'self'`
- **GitHub Actions SHA-pin**: 全 5 アクションをコミット SHA で固定（サプライチェーン攻撃防止）
- **Dependabot**: github-actions + npm の週次自動更新
- **年齢ガード**: `retirementAge > currentAge`、`endAge > retirementAge`、`endAge ≤ 120` を `formToSimulationInput()` で強制
- **numTrials 上限**: 10,000（JSON インポート経由の過大値防御）
- **safeNum**: 全拡張フィールド（pension / sideIncome / lifeEvents / nisaConfig）に NaN・負値ガード
- **共有 URL**: 圧縮 50KB / 展開 500KB 上限（decompression bomb 防御）
- **配列長上限**: portfolio ≤ 20、lifeEvents ≤ 30、targetAllocation ≤ 20（O(n²) DoS 防御）
- **targetAllocation バリデーション**: weight 型チェック + 0–1 クランプ
- **配偶者ガード**: `spouseFormToInput` に同等の整合性チェック

---

## 14. デプロイ

- **本番**: https://akiyoshi.github.io/fire-sanbo/
- **CI/CD**: [.github/workflows/deploy.yml](.github/workflows/deploy.yml) — lint → test → E2E → build → deploy-pages
- **Vite base**: `/fire-sanbo/`（GitHub Pages サブパス）
- **OGP**: `og:image` 絶対 URL、`twitter:card = summary_large_image`、1200×630 PNG
- **Favicon**: SVG + 32px PNG + 180px Apple Touch Icon

---

## 15. 依存関係ポリシー

**原則: 安定版を採用し、最前線を追わない。**

| 種別 | 指定子 | 例 |
|------|-------|-----|
| ツールチェーン | `~`（パッチのみ自動更新） | typescript ~5.9.3、eslint ~9.39.4 |
| ランタイム | `^`（マイナーまで自動更新） | react ^19.2.5、recharts ^3.8.1 |
| canary / rc | 禁止（devDeps であっても） | — |

### Dependabot ルール

- **パッチ / マイナー**: 自動 PR → CI グリーンなら速やかにマージ
- **メジャーバンプ**: typescript / eslint / vite / @types/node は `dependabot.yml` で ignore。手動評価で（1）本プロジェクトが新機能を必要としているか、（2）主要プラグインが対応済みか、（3）破壊的変更リストを確認

### 現在の安定版ベースライン

| パッケージ | バージョン | 指定子 | 理由 |
|-----------|----------|--------|------|
| typescript | 5.9.x | `~5.9.3` | strict + bundler moduleResolution で十分 |
| eslint | 9.x | `~9.39.4` | flat config、プラグインエコシステム安定 |
| eslint-plugin-react-hooks | 7.x | `^7.0.1` | rules-of-hooks + exhaustive-deps のみ |
| @types/node | 22.x | `^22` | CI Node.js 22 と一致 |
| vite | 6.x | `^6.3.5` | 安定リリース |
| vite-tsconfig-paths | 5.x | `^5.1.4` | TS5 対応安定版 |

> **教訓**: TypeScript 6 + ESLint 10 への同時メジャーバンプで eslint.config 全面書き直し・canary 依存・18 件の未使用 import 修正が発生。本プロジェクトが使っていない新機能のために破壊的変更を受け入れる価値はない。

---

## 16. 設計原則

- **後方互換**: 新フィールドはすべてオプショナル、デフォルト値で既存動作を維持
- **エンジン分離**: `src/lib/` は純 TypeScript、React 非依存
- **FormState スキーマバージョニング**: v2 → v3 → v4 → v5 のマイグレーションパス
- **テスト駆動**: 税制計算・シミュレーション・最適化は独立してテスト可能
