# FIRE参謀 — TODOs（バックログ）

ナビゲーション: [README](README.md) · [DESIGN](DESIGN.md) · [ARCHITECTURE](ARCHITECTURE.md) · **TODOS** · [Archive](docs/archive/)

> 改善余地がある領域を優先度順に列挙する作業バックログ（Diataxis: How-to / planning）。
> ビジョン・設計判断は [DESIGN.md](DESIGN.md)、現状アーキテクチャは [ARCHITECTURE.md](ARCHITECTURE.md) を参照。
> リリース履歴は `git log --oneline` および git tag を参照（本ファイルは「未着手の改善案」のみを扱う）。

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
- 直近の対象: 2027 年度

### 📋 依存関係の継続メンテナンス

- Dependabot のパッチ・マイナー PR を週次でマージ
- メジャーバンプは [ARCHITECTURE.md §15](ARCHITECTURE.md#15-依存関係ポリシー) のチェックリストに従う
- 既知の保留: TypeScript 6、ESLint 10、Vite 7、@types/node 24（エコシステム追従待ち）

---

## P0 — リリース体験の安全化

### 🔥 deploy 失敗検出フロー（`/ship` 事前ゲート + post-push 監視）

**背景**: v4.6.0〜v4.6.6 の 7 本連続でデプロイが失敗し、本番が v4.5.10 のまま約 1 時間取り残された。原因は CI の `npm run lint` (`@typescript-eslint/no-explicit-any`) が `migrate.ts` で 7 件失敗していたが、`/ship` の事前検証は `vitest` + `tsc` のみで lint 未実行だったため見過ごした。

**目的**: 「ローカルは緑、CI は赤、本番は古い版のまま」という silent failure を二度と起こさない。

**実装**:

1. **`/ship` 事前ゲートの強化**（最重要）
   - `npm run lint` を tests / build と同列で必須チェックに昇格
   - lint 失敗時は commit 前に停止、自動修正可能なものは fix offer
2. **CI 失敗時のローカル通知 / 検出**
   - push 後 90 秒以内に `gh run list --limit 1 --json conclusion` をポーリング
   - 失敗時は `.gstack/last-deploy-status.json` に書き込み、各スキル起動時に確認
   - 別案: `gh run watch` を `/ship` 最終ステップに同梱（最大 5 分待機）
3. **連続失敗の自動検出**
   - `gh run list --workflow=deploy.yml --limit 10` で過去10本を取得
   - 直近 3 本以上が `failure` ならセッション開始時に🔴アラートを表示し `/land-and-deploy` を提案
4. **Dependabot PR の deploy 失敗対応** — メジャーバンプでも同じ仕組みで早期検出
5. **ドキュメント** — [ARCHITECTURE.md §14 デプロイ](ARCHITECTURE.md#14-デプロイ) に「deploy 失敗時のリカバリ手順」を追記

**完了条件**:
- [ ] `/ship` スキルに `npm run lint` ゲート追加
- [ ] 連続失敗検出ロジックの実装と検証
- [ ] ARCHITECTURE.md にリカバリ手順追記
- [ ] 学習記録（user memory）にコミット

### 📋 リリースノートの累積価値設計

CEO Outside Voice の懸念（[v4.6 autoplan review Phase 1](docs/v4.6-autoplan-review.md)）。段階リリースで「成功率 67% → 67.2%」のような微差を訴求するのではなく、「税理士相談で発見される論点を未然にカバー」のような累積価値を伝えるリリースノート構造を確立する。

- v4.6 系（住民税ショック / ふるさと納税 / SWR / 5/19年）の累積版リリースノートをサンプルとして書き起こす
- `/document-release` スキルにリリースノート生成テンプレートを追加

### 📋 gstack-review v4.6.5 で検出した Known Issues

`/gstack-review` で検出された未対応項目（v4.6.6 で auto-fix 済みは除外）。

- **C4: `calcSWR` の main-thread blocking** ([results.tsx:303](src/components/results.tsx)) — useMemo 同期で 25 反復 × 100 試行 × 60 年 ≈ 150K trial-years/tick。numTrials=100 キャップで現状許容範囲だが、低スペック端末で UX 遅延の可能性。**対応案**: SimulationWorker に `calcSWR` メソッド追加 or 200ms debounce
- **E2E OR-match flakiness** ([e2e/app.spec.ts](e2e/app.spec.ts)) — `getByText(/住民税の翌年請求分|退職準備チェックリスト/)` が成功率 100% でも別パスで pass する。低資産+高支出で worst-case を強制する形に書き直し
- **`findOptimalIdecoLumpSumAge.byAge` 未使用フィールド** ([tax/engine.ts](src/lib/tax/engine.ts)) — UI が消費していない。グラフ表示が決まるまで保留 or 削除
- **`furusatoLimit` の hot-loop 計算** ([simulation/engine.ts](src/lib/simulation/engine.ts)) — 全試行 × 全年で `calcAnnualTax` + `calcFurusatoLimit` を実行。UI は 5 年刻み消費。lazy 化または post-trial 計算へ
- **5/19 年「年単位近似」表記の UI 反映** — エンジン JSDoc には記載済みだが、methodology page §16 と results.tsx の処方箋カードコピーにも明記する

---

## P1 — UX 改善

### 💭 ウィザード UI に未配線コンポーネントを配線

[src/components/wizard/](src/components/wizard/) には実装済みだが [wizard.tsx](src/components/wizard.tsx) で未 import の以下が眠っている。エンジン側は対応済みのため UI 配線のみで利用可能。

- **`spouse-section.tsx`** — 配偶者の年齢・退職年齢・年収を入力する CollapsibleCard。FormState `spouseEnabled` / `spouse` は既に v3+ で対応済み。**最優先**: CEO Outside Voice ([v4.6 autoplan review](docs/v4.6-autoplan-review.md)) 推定で想定ユーザーの 60–70% が世帯計画ニーズ。1–2 日で ship 可能
- `template-selector.tsx` — 5 種テンプレート（転職 / 住宅購入 / 教育費 / 早期退職 / 年金繰下げ）。`scenario-templates.ts` は実装済み。採否を再評価
- `quick-start.tsx` — 3 項目クイックスタート（v1.8.0 実装、v4.5.0 で `BasicSection` に統合した経緯あり、現状は重複）。削除候補
- `quick-preview.tsx` — ライブプレビュー。削除候補

### 💭 シーケンスリスクの可視化 `[FP-CFA-Tax]`

退職直後 5–10 年のリターン序列が成功率を支配する事実が結果画面に出ていない。`runSimulation()` で「最初 5 年の累積リターンが下位 25% だった試行のみ」のパーセンタイルを別系列で計算し、グラフに薄い赤系列を重ねて表示。詳細: [改善計画書 §5.5](docs/improvement-plan-fp-cfa-tax.md#55-c-1-シーケンスリスクの可視化)

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

納税者所得 ≤900万 / 950万 / 1000万 と配偶者所得 0–48万 / 48–133万 のテーブルから自動算定。専業主婦ケースで年税額 10 万円前後の差が出る。`tax/engine.ts` に `calcSpouseDeduction(primaryIncome, spouseIncome)` を追加。

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

### 💭 SWR の Worker 化

P0 Known Issues C4 (`calcSWR` の main-thread blocking) の根本解決として、`SimulationWorker` に `calcSWR` メソッドを追加し、results.tsx から `useEffect` 経由で非同期実行する。numTrials を 200+ に拡張する判断点で着手。

### 💭 runTrial / runTrialLite の統合

[prescription/engine.ts](src/lib/prescription/engine.ts) の `runTrialLite` は [simulation/engine.ts](src/lib/simulation/engine.ts) `runTrial` の手動コピーで、リバランス・配偶者・口座別リターン・ふるさと納税出力が未実装。drift 検出テスト（[prescription/engine.test.ts](src/lib/prescription/engine.test.ts)）で同期忘れは検出できるが、根本解決として共通ヘルパーへの抽出を検討。

---

## P3 — 計算根拠書 / メソドロジー

### 💭 セクション間クロスリファレンス

18 セクションに「関連: §3 累進ブラケット」のような相互リンクを追加し、読者が任意の起点から計算根拠を辿れるようにする。

### 💭 動的計算例の入力可変化

現状はハードコード入力（年収 600 万等）で計算例を示す。読者が「自分の年収」を入力するとリアルタイムで計算例が更新される入力ボックスを 4–5 セクションに追加。

---

## P4 — 開発者体験 / 品質

### 📋 engine.test.ts 残りベタ書き入力の整理

v4.5.8 で `src/lib/test-utils/` を導入し、約 10 箇所のベタ書き `SimulationInput` を `createSimulationInput({...})` 経由に整理した。残り約 16 箇所のベタ書き入力（特に `tokuteiGainRatio: 0` のような非デフォルト値を含むテスト）はまだ未整理。

- 対象: [src/lib/simulation/engine.test.ts](src/lib/simulation/engine.test.ts) の `const x: SimulationInput = { ... }` 形式
- 方針: 各テストの差分のみが見える形に整理（共通項はデフォルト値に依存させる）
- 注意: `tokuteiGainRatio: 0` / `goldGainRatio: 0` などデフォルト値（0.5 / 0.3）と異なる箇所は明示的に override する必要がある

### 💭 リリース KPI 計装

CEO Outside Voice ([v4.6 autoplan review](docs/v4.6-autoplan-review.md)) の問題提起。「成功率改善」以外の KPI を計装する。

- 候補: 「処方箋カードで実行された施策数」「シナリオ比較の利用率」「計算根拠書の閲覧深度」
- localStorage ベースのプライバシー尊重型計装（外部サーバー送信なし）
- DESIGN.md スコープに新セクションを追加する判断含めて検討

### 💭 Storybook 導入

shadcn/ui コンポーネント + 自前カードコンポーネント（prescription-card / worst-case-card / withdrawal-card / portfolio-optimizer）のビジュアルリグレッションテスト。Vite 連携の Storybook 8。

### 💭 Mutation Testing

Stryker で `src/lib/tax/` `src/lib/simulation/` のミューテーションスコアを測定。テストが「本当に振る舞いを検証しているか」のメタ評価。

### 💭 E2E カバレッジ拡大

現在 9 テスト（基本フロー + 共有 URL + What-if + SWR サマリ + 退職準備 + ふるさと納税 details）。追加候補:

- シナリオ保存 → 一覧復元
- JSON エクスポート / インポート往復
- 計算根拠書のスティッキー目次のスクロール追従
- 配偶者あり世帯の入力 → 結果（spouse-section の P1 配線が前提）

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
- **CHANGELOG ファイル能動更新**: git log + git tag で十分（現状の `CHANGELOG.md` は履歴アーカイブとして残置のみ）
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

過去の完了済みバックログ要約は `git log --oneline` および git tag を参照。本ファイルからは「未着手の改善案」のみを扱うため、完了済みリストは持たない（重複防止 — Diataxis: TODOs ≠ History）。
