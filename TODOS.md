# FIRE参謀 — TODOs（ロードマップ）

ナビゲーション: [README](README.md) · [DESIGN](DESIGN.md) · [ARCHITECTURE](ARCHITECTURE.md) · **TODOS** · [Archive](docs/archive/)

> 凍結解除（v4.5.7 以降）。改善余地がある領域を「優先度順」に列挙する作業バックログ（Diataxis: How-to / planning）。
>
> ビジョン・設計判断は [DESIGN.md](DESIGN.md)、現状アーキテクチャは [ARCHITECTURE.md](ARCHITECTURE.md) を参照。

ステータス凡例: 🔥 着手中 / 📋 計画 / 💭 アイディア / ❄️ 一旦保留

---

## P0 — 必須メンテナンス（年次タスク）

### 📋 2027 年度税制 JSON 追加（v4.6 / 2027 年 1 月）

- `src/config/tax-config-2027.json` を作成（基礎控除・給与所得控除・所得税ブラケット・住民税・年金等控除・社保料率の更新）
- `tax-config-index.ts` の `getTaxConfig(year)` に分岐追加
- `tax-config-index.test.ts` に 2027 年度のスナップショットテスト追加
- 年度跨ぎの設計判断: **開始年度の税制で全シミュレーション期間を固定**（将来の税制変更は反映しない旨を免責条項に明記）

### 📋 依存関係の継続メンテナンス

- Dependabot のパッチ・マイナー PR を週次でマージ
- メジャーバンプは [ARCHITECTURE.md §15](ARCHITECTURE.md#15-依存関係ポリシー) のチェックリストに従う
- 既知の保留: TypeScript 6、ESLint 10、Vite 7、@types/node 24（エコシステム追従待ち）

---

## P1 — UX 改善

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

### 💭 配偶者の独立 NISA 枠

現状: NISA 枠は世帯共有で計算。実態に合わせて Primary / Spouse の年間 360 万・生涯 1,800 万を独立で追跡し、それぞれの口座から取り崩し可能にする。`SimulationInput.spouse.nisaConfig?` を追加し、`MemberAccounts` に NISA 累計を独立で持たせる。

### 💭 ローン残債モデル

ライフイベントは「一時支出」のみ。住宅ローン・教育ローンを「残債 + 月次返済 + 金利」として扱えるオプション（残債が完済するまで毎年支出計上、繰上返済シミュレーション）。

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

以下は明確に不採用とした項目（混乱防止のため記録）:

- **PWA 化**: 月 1 回のツールに Service Worker は過剰
- **リブランド / 名前変更**: ユーザー基盤が小さくコストに見合わない
- **BtoB 検証 / 法人向け展開**: 個人ツールの延長として飛躍しすぎ
- **CHANGELOG ファイル維持**: git log で十分（現状の `CHANGELOG.md` は履歴アーカイブとして残置のみ）
- **VS Code 拡張化 / Electron アプリ化**: ブラウザ単体で完結する利点を失う

---

## 完了済み（v4.0 → v4.5.7 で消化されたバックログ）

要約のみ。詳細は [ARCHITECTURE.md](ARCHITECTURE.md) と git log を参照。

- v1.5.x: GitHub Pages デプロイ、a11y 基盤、SVG 化、CSP、SHA-pin、年齢ガード
- v1.6.x: a11y 拡充（nav ランドマーク、skip-to-content、WCAG AA）
- v1.7.0: 共有 URL（DeflateRaw + Base64url）
- v1.8.0: クイックスタート（後に v4.5.0 で基本情報に統合）
- v1.9.0: レスポンシブ、dialog/aria-modal/Esc、OKLCH トークン
- v2.0.0: React.lazy コード分割、Playwright E2E、CI E2E ゲート
- v2.0.1: 依存関係ポリシー策定、TS6/ESLint10 ロールバック
- v3.0: テンプレートセレクター、処方箋スケルトン、チャートデータテーブル、44px タッチターゲット、税制年度切替基盤
- v4.0: 取り崩し最適化（全順列 24 通り）、結果画面 1 カラム化、p5 vs 中央値テーブル
- v4.2: 口座別リターン
- v4.3: 目標アセットアロケーション + リバランス（積立・退職後）、FormState v5
- v4.5.0: はじめにガイド（チュートリアル）、QS カード廃止
- v4.5.1: CostBasis 動的追跡
- v4.5.2–v4.5.5: simulation/helpers、CostBasis クラス、MemberAccounts、runTrialLite 統合（−165 行 / +29 テスト、Spouse iDeCo 60 歳バグ修正）
- v4.5.6: テストカバレッジ拡充（269 → 279 ユニット、4 → 6 E2E）
- v4.5.7: form-state 5 分割、マジックナンバー定数化、`member-withdrawal.ts` / `selectByMode()` 追加（279 → 293 テスト）
