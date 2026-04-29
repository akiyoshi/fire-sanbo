# FIRE参謀 — TODOs（バックログ）

ナビゲーション: [README](README.md) · [DESIGN](DESIGN.md) · [ARCHITECTURE](ARCHITECTURE.md) · **TODOS** · [Archive](docs/archive/)

> 改善余地がある領域を優先度順に列挙する作業バックログ（Diataxis: How-to / planning）。
> ビジョン・設計判断は [DESIGN.md](DESIGN.md)、現状アーキテクチャは [ARCHITECTURE.md](ARCHITECTURE.md) を参照。
> リリース履歴は [CHANGELOG.md](CHANGELOG.md) と git log を参照（本ファイルは「未着手の改善案」のみを扱う）。

ステータス凡例: 🔥 着手中 / 📋 計画 / 💭 アイディア / ❄️ 凍結

> **FP / CFA / 税理士視点の精査による改善計画**: [docs/improvement-plan-fp-cfa-tax.md](docs/improvement-plan-fp-cfa-tax.md)
> 末尾に `[FP-CFA-Tax]` タグが付いた項目は上記計画書から取り込んだバックログ。詳細・出典・実装スケッチは計画書を参照。

---

## 🔁 継続メンテナンス（recurring）

機能バックログとは別軸の、定期発生するタスク。優先度は付かない（必要になった時点で対応）。

### 📋 年次税制 JSON 追加（毎年1月）

- 翌年度の `src/config/tax-config-YYYY.json` を作成（基礎控除・給与所得控除・所得税ブラケット・住民税・年金等控除・社保料率を更新）
- `tax-config-index.ts` の `getTaxConfig(year)` に分岐追加
- `tax-config-index.test.ts` にスナップショットテスト追加
- 設計判断: **開始年度の税制で全シミュレーション期間を固定**（将来の税制変更は反映しない、免責条項に明記）
- 直近の対象: 2027 年度（v4.6 期予定）

### 📋 依存関係の継続メンテナンス

- Dependabot のパッチ・マイナー PR を週次でマージ
- メジャーバンプは [ARCHITECTURE.md §15](ARCHITECTURE.md#15-依存関係ポリシー) のチェックリストに従う
- 既知の保留: TypeScript 6、ESLint 10、Vite 7、@types/node 24（エコシステム追従待ち）

---

## P0 — v4.6 マイルストーン（FP / CFA / 税理士 精度向上）

`[FP-CFA-Tax]` 計画書 §4.1 から抜粋。プロのFP相談で必ず話題になる項目で、未対応のままだと「精度の高いツール」とは言えない領域。

### 📋 退職翌年の住民税ショック計上 `[FP-CFA-Tax]`

- 退職前年の所得 × 10% を `age = retirementAge + 1` の支出に自動加算
- `simulation/engine.ts` フェーズ1（収入）に1ブロック追加、`taxBreakdown.residentTax` に積算
- テスト: 退職翌年の `taxBreakdown.residentTax` が前年所得に比例することを確認
- UI: 「退職前1年のチェックリスト」に現金枠確保アラート
- 詳細: [改善計画書 §5.3](docs/improvement-plan-fp-cfa-tax.md#53-f-2--t-10-退職翌年の住民税)

### 📋 ふるさと納税の年次上限算定 `[FP-CFA-Tax]`

- `src/lib/tax/engine.ts` に `calcFurusatoLimit(taxableIncome, marginalRate)` を追加
- 年次の上限額を結果画面のアクションカレンダー（12月）に表示
- 退職後は雑所得（年金＋副収入）の課税所得から再計算
- テスト: 課税所得別の境界値 + 主要ブラケット（5/10/20/23/33%）でスナップショット
- 詳細: [改善計画書 §5.4](docs/improvement-plan-fp-cfa-tax.md#54-t-7-ふるさと納税上限)

### 📋 SWR（Safe Withdrawal Rate）自動算定 `[FP-CFA-Tax]`

- `src/lib/swr/engine.ts` を新設、`prescription/engine.ts` の expense 軸の二分探索を再利用
- 出力: `{ maxAnnualExpense, rate, vsBengen4Pct }`
- UI: 結果画面の「最優先アクション」カードに「90% 成功する月支出 = X 万円」
- 詳細: [改善計画書 §5.2](docs/improvement-plan-fp-cfa-tax.md#52-c-3-swr-自動算定)

### 📋 iDeCo × 退職金 5/19 年ルール `[FP-CFA-Tax]`

- 退職所得控除の重複期間ルール（所得税法施行令70条）をエンジンに追加
- `RetirementBonusInput.receiveAge` / 新型 `IdecoConfig` を `SimulationInput` に
- `tax/engine.ts` に `calcEffectiveYearsForLumpSum()` を追加
- 処方箋に新軸 `idecoTiming` を追加（離散探索 60–75）
- 期待効果: 典型ケースで手取り合計 +60–80 万円
- 詳細: [改善計画書 §5.1](docs/improvement-plan-fp-cfa-tax.md#51-t-2-ideco--退職金の-519年ルール)

---

## P1 — UX 改善

### 💭 ウィザード UI に未配線コンポーネントを配線

[src/components/wizard/](src/components/wizard/) には実装済みだが [wizard.tsx](src/components/wizard.tsx) で未 import の以下が眠っています。エンジン側は対応済みのため UI 配線のみで利用可能になります。

- `spouse-section.tsx` — 配偶者の年齢・退職年齢・年収を入力する CollapsibleCard。FormState `spouseEnabled` / `spouse` は既に v3+ で対応済み
- `template-selector.tsx` — 5 種テンプレート（転職 / 住宅購入 / 教育費 / 早期退職 / 年金繰下げ）。`scenario-templates.ts` は実装済み
- `quick-start.tsx` — 3 項目クイックスタート（v1.8.0 実装、v4.5.0 で `BasicSection` に統合した経緯あり、現状は重複）
- `quick-preview.tsx` — ライブプレビュー

判断: spouse-section の配線が最優先（エンジン機能の主要ギャップ）。template-selector は採否を再評価。quick-start / quick-preview は削除候補（重複機能）。

### 💭 シーケンスリスクの可視化 `[FP-CFA-Tax]`

退職直後5–10年のリターン序列が成功率を支配する事実が結果画面に出ていない。`runSimulation()` で「最初5年の累積リターンが下位25%だった試行のみ」のパーセンタイルを別系列で計算し、グラフに薄い赤系列を重ねて表示。詳細: [改善計画書 §5.5](docs/improvement-plan-fp-cfa-tax.md#55-c-1-シーケンスリスクの可視化)

### 💭 iDeCo 拠出フェーズ `[FP-CFA-Tax]`

現状は `accounts.ideco` の初期残高のみ。職業別拠出限度（自営業 6.8万円/月、企業年金なし会社員 2.3万円/月、専業主婦 2.3万円/月、公務員 2万円/月）と所得控除効果（実効限界税率×拠出額）をエンジンに追加。ウィザードに iDeCo 拠出セクションを新設。

### 💭 アクションカレンダー `[FP-CFA-Tax]`

結果画面に新タブ「アクションカレンダー」を追加。`src/lib/action-calendar/engine.ts` を新設し、年次タスク（12月: ふるさと納税、3月: 確定申告）+ ライフイベント前後タスク（退職前1年: 健保比較、退職年: 住民税予算）を暦ベースで生成。localStorage に完了状態を保存。詳細: [改善計画書 §5.6](docs/improvement-plan-fp-cfa-tax.md#56-f-10-アクションカレンダー)

### 💭 退職後健保の3択比較 `[FP-CFA-Tax]`

任意継続（最大2年・上限月3.4万円程度）vs 国保 vs 家族被扶養者 を退職時点で比較し、「最初2年は任継 → 3年目以降は国保」の最適切替プランを処方箋に追加。任継保険料 = 標準報酬月額 × 約12% × 12ヶ月（上限あり）。

### 💭 結果画面のオンボーディングオーバーレイ

新規ユーザー向けに、結果画面の「成功率ゲージ → What-if スライダー → 処方箋」を 3 ステップでハイライトするコーチマーク。`localStorage` に `hasSeenResultsTour` を保存し 1 回限り表示。

### 💭 シナリオ比較画面の差分強調

[scenario-compare.tsx](src/components/scenario-compare.tsx) で 2 シナリオの「数値が異なるパラメータ」を色付きで自動ハイライト（同一値はグレーアウト）。現状は全パラメータがフラットに並んでいるため差分が読み取りにくい。

### 💭 処方箋の「組み合わせ提案」

現状は 4 軸独立。たとえば「退職を 2 年延期 + 生活費 −5% で 90% に」のような複合処方を 1 件追加する。実装: 二分探索を 2 軸同時に走査（O(n²)）し、Pareto フロンティアから最小負担の組を選ぶ。

### 💭 モバイルフォーム UX

- ウィザードのセクション間ナビゲーション（次へ／前へボタン）
- 数値入力でテンキーキーボード（`inputmode="numeric"` 適用範囲を再点検）
- スティッキー CTA の半透明度をスクロール量に応じて変える

---

## P2 — エンジン拡張

### 💭 ローン残債モデル＋住宅ローン控除 `[FP-CFA-Tax]`

ライフイベントは「一時支出」のみ。住宅ローン・教育ローンを「残債 + 月次返済 + 金利」として扱えるオプション（残債が完済するまで毎年支出計上、繰上返済シミュレーション）。同時に住宅ローン控除（年末残高×0.7%×13年、新築一般4000万・認定5000万）をモデル化。所得3000万円超は対象外。

### 💭 子の扶養モデル `[FP-CFA-Tax]`

児童手当（中学生まで月1万、第3子以降増額）、教育費（公立／私立、高校無償化）、扶養控除（所得税: 一般38万、特定63万、老人48/58万 / 住民税: 33/45/45/38万）を一体化。`SimulationInput.dependents?: DependentInput[]` を追加。

### 💭 配偶者控除／配偶者特別控除 `[FP-CFA-Tax]`

納税者所得 ≤900万 / 950万 / 1000万 と配偶者所得 0–48万 / 48–133万 のテーブルから自動算定。専業主婦ケースで年税額10万円前後の差が出る。`tax/engine.ts` に `calcSpouseDeduction(primaryIncome, spouseIncome)` を追加。

### 💭 NISA 成長/つみたて分離管理 `[FP-CFA-Tax]`

成長240万＋つみたて120万、生涯1800万のうち成長部分上限1200万。商品制限（つみたては金融庁適格のみ）も型レベルで反映。`NisaConfig` に `growthAnnual` / `tsumitateAnnual` / `growthLifetimeCap` を追加。

### 💭 ガードレール戦略（Guyton-Klinger） `[FP-CFA-Tax]`

実質定額（Constant Real Spending）以外の取り崩し戦略を選択可能に。資産が想定経路から ±20% 乖離したら支出を ±10% 調整。`SimulationInput.withdrawalStrategy: "constantReal" | "guytonKlinger" | "constantPercentage"` を追加。

### 💭 配偶者の独立 NISA 枠

現状: NISA 枠は世帯共有で計算。実態に合わせて Primary / Spouse の年間 360 万・生涯 1,800 万を独立で追跡し、それぞれの口座から取り崩し可能にする。`SimulationInput.spouse.nisaConfig?` を追加し、`MemberAccounts` に NISA 累計を独立で持たせる。

### 💭 為替リスクの考慮

外国株・外国債券に対する円建てリターンの不確実性。現状は `expectedReturn` に円建て期待値を含めて入力する想定だが、為替変動を独立パラメータ化（USD/JPY のボラティリティ、相関）すると精度向上。

### 💭 複数の取り崩しプロファイル

現状は単一の `withdrawalOrder`。「退職直後 5 年間は cash 優先 → その後 NISA → 特定口座」のような期間別ルールを設定可能にする。実装は `withdrawalOrder: WithdrawalRule[]` に拡張、各ルールに `fromAge` / `toAge` を持たせる。

---

## P3 — 計算根拠書 / メソドロジー

### 💭 セクション間クロスリファレンス

15 セクションに「関連: §3 累進ブラケット」のような相互リンクを追加し、読者が任意の起点から計算根拠を辿れるようにする。

### 💭 動的計算例の入力可変化

現状はハードコード入力（年収 600 万等）で計算例を示す。読者が「自分の年収」を入力するとリアルタイムで計算例が更新される入力ボックスを 4–5 セクションに追加。

---

## P4 — 開発者体験 / 品質

### 📋 engine.test.ts 残りベタ書き入力の整理

v4.5.8 で `src/lib/test-utils/` を導入し、約 10 箇所のベタ書き `SimulationInput` を `createSimulationInput({...})` 経由に整理した。残り約 16 箇所のベタ書き入力（特に `tokuteiGainRatio: 0` のような非デフォルト値を含むテスト）はまだ未整理。

- 対象: [src/lib/simulation/engine.test.ts](src/lib/simulation/engine.test.ts) の `const x: SimulationInput = { ... }` 形式
- 方針: 各テストの差分のみが見える形に整理（共通項はデフォルト値に依存させる）
- 注意: `tokuteiGainRatio: 0` / `goldGainRatio: 0` などデフォルト値（0.5 / 0.3）と異なる箇所は明示的に override する必要がある

### 💭 Storybook 導入

shadcn/ui コンポーネント + 自前カードコンポーネント（prescription-card / worst-case-card / withdrawal-card / portfolio-optimizer）のビジュアルリグレッションテスト。Vite 連携の Storybook 8。

### 💭 Mutation Testing

Stryker で `src/lib/tax/` `src/lib/simulation/` のミューテーションスコアを測定。現状 293 ユニットテストがあるが「テストが本当に振る舞いを検証しているか」のメタ評価が欠落。

### 💭 E2E カバレッジ拡大

現在 6 テスト（基本フロー + 共有 URL + What-if）。追加候補:
- シナリオ保存 → 一覧復元
- JSON エクスポート / インポート往復
- 計算根拠書のスティッキー目次のスクロール追従
- 配偶者あり世帯の入力 → 結果

### 💭 パフォーマンス予算

- Lighthouse CI で初期バンドル < 400KB、LCP < 2.5s を CI ゲート化
- Worker 計算時間（1,000 試行）を p95 < 1.5s でモニタ

---

## ❄️ 凍結（恒久 No-go）

明確に不採用とした項目（混乱防止のため記録）。再評価の必要が出た場合のみここから出す。

### プロダクトレベル

- **PWA 化**: 月 1 回のツールに Service Worker は過剰
- **リブランド / 名前変更**: ユーザー基盤が小さくコストに見合わない
- **BtoB 検証 / 法人向け展開**: 個人ツールの延長として飛躍しすぎ
- **CHANGELOG ファイル能動更新**: git log で十分（現状の `CHANGELOG.md` は履歴アーカイブとして残置のみ）
- **VS Code 拡張化 / Electron アプリ化**: ブラウザ単体で完結する利点を失う

### エンジン / 運用理論 `[FP-CFA-Tax]`

- **ファクター（バリュー／サイズ／低ボラ等）レベルのアロケーション**: 個人投資家の運用粒度として過剰
- **Student-t 等の Fat-tail 分布**: 影響は p1 のみで意思決定が変わるユースケースが薄い
- **危機相関（時変共分散）**: 既存共分散モデルのストレステストで近似可能

### 税制 / 制度 `[FP-CFA-Tax]`

- **相続税・贈与税**: DESIGN.md スコープ境界外（個人ライフタイムのみ）
- **特別法人税（iDeCo課税の凍結）**: 政治リスクのみ。免責条項に追記で十分
- **国保保険料の都道府県・市区町村差**: 全国標準で誤差 ±10% に収まる

### テスト戦略（再評価済み）

- **確率テストの許容幅明示化**: 全確率テストは `seed: 42` で deterministic、現行閾値はリファクタリング耐性十分。CI実行時間とのトレードオフが見合わない（v4.5.8 で再評価）
- **cost-basis 細粒度テストの統合化**: `CostBasis` は公開 API から呼ばれるドメインクラス。各テストが数値安定性・ゼロ除算防止・含み損回復などの不変式を検証しており、統合テストに丸めると回帰検出力が下がる（v4.5.8 で再評価）
- **prescription-card UI モックの E2E 移行**: 現状 unit テストは `vi.useFakeTimers()` で確定的かつ高速 (≈100ms)。E2E に移すと再計算完了の待機が確率的になり flaky リスク。E2E は What-if スライダーでメインフローカバー済み（v4.5.8 で再評価）

---

## メモ: 完了したバックログの参照先

過去の完了済みバックログ要約は **[CHANGELOG.md](CHANGELOG.md)** および `git log --oneline` を参照。本ファイルからは「未着手の改善案」のみを扱うため、完了済みリストは持たない（重複防止）。
