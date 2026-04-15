# FIRE参謀 — 人生の資産設計エンジン（日本版）

> **バージョン**: v4.0.0
> **更新日**: 2026-04-15
> **ライブ**: https://akiyoshi.github.io/fire-sanbo/

## ビジョン

**日本の税制・社会保障を正確に組み込んだ、個人向けライフタイム資産シミュレーター。**

年金・退職金・ライフイベント・世帯収支・ポートフォリオ最適化を統合した
「人生の資産設計エンジン」。

## 実装済み機能

### コアエンジン

| 機能 | 実装 | テスト |
|------|------|--------|
| モンテカルロシミュレーション | `simulation/engine.ts` runTrial | 29テスト |
| 最悪ケース診断 | `simulation/diagnosis.ts` | 7テスト |
| 日本税制エンジン (2026年度) | `tax/engine.ts` | 39テスト |
| 処方箋 (3軸二分探索) | `prescription/engine.ts` runTrialLite | 10テスト |
| 取り崩し最適化 | `withdrawal/optimizer.ts` | 13テスト |
| ポートフォリオ合成 | `portfolio/engine.ts` | 10テスト |
| ポートフォリオ最適化 | `portfolio/optimizer.ts` | 13テスト |
| FormState永続化 + バリデーション | `form-state.ts` | 36テスト |
| 共有URL圧縮 | `url-share.ts` | 16テスト |
| シナリオテンプレート | `scenario-templates.ts` | 10テスト |
| 税制年度切替 | `tax-config-index.ts` | 4テスト |
| **合計** | | **187テスト** |

### 収入モデル

- **給与所得**: 所得税・住民税・社会保険料を控除した手取り
- **公的年金**: 厚生年金 + 国民年金、繰上げ(0.4%/月減額)・繰下げ(0.7%/月増額)
  - 公的年金等控除(65歳未満/65歳以上)適用
- **退職金**: 退職所得控除(勤続年数ベース) + 分離課税
- **副収入**: 退職後のフリーランス/不労所得(基礎控除のみ)

### 支出モデル

- **定額生活費**: 月間生活費 × 12 (インフレ率反映)
- **ライフイベント**: 年齢指定の一時支出(住宅購入・教育費・結婚・車等)
- **社会保険料**: 退職後は所得0ベースで再計算

### 積立モデル

- **NISA枠管理**: 年間投資枠(360万) + 生涯投資枠(1,800万)の追跡
- **余剰配分**: 手取り − 費用負担 → NISA → 特定口座の順
- **退職前赤字**: ライフイベント等で赤字時は口座から取り崩し

### 世帯シミュレーション

- **配偶者サポート**: 年齢差・退職時期差に対応した2人分の同時シミュレーション
- **費用負担**: 在職者数に応じた均等分担、退職者の年金・副収入を統合
- **取り崩し順序**: Primary口座 → Spouse口座(各withdrawal order順)

### ポートフォリオ最適化

- **効率的フロンティア**: モンテカルロ法(10,000サンプル、ディリクレ分布)で近似
- **リスク許容度**: 0(最小リスク) → 1(最大リターン)のスライダー
- **SVGチャート**: フロンティア曲線 + 推奨点
- **ワンクリック適用**: 最適配分をポートフォリオに即反映

### 処方箋エンジン

- **3軸の二分探索**: 支出削減 / 退職延期 / 追加投資
- **年金・退職金・副収入・ライフイベント反映済み**
- **難易度タグ**: やさしい / ふつう / むずかしい

### 最悪ケース診断書

- **p5失敗シナリオ分析**: 下位5%パーセンタイルの試行を抽出し失敗原因を自動分類
- **4分類**: 暴落型 / 資金不足型 / ライフイベント集中型 / 長寿リスク型

### 取り崩し最適化 (v4.0)

- **全パターン評価**: cash末尾固定、残りの口座の全順列(最大4!=24通り)を評価
- **決定論的モード**: stdDev=0, numTrials=1 の中央値シナリオで<50ms同期計算
- **UI接続**: 結果画面の2軍セクション(折りたたみ)に最適順序・改善額・全順位表を表示
- **ワンクリック適用**: 最適順序をFormStateに反映→即再計算

### 結果画面の情報階層化 (v4.0)

- **1軍(常時表示)**: 成功率・資産推移チャート・What-ifスライダー・最悪ケース診断書
- **2軍(折りたたみ)**: 処方箋・取り崩し最適化・税負担の内訳
- **`<details>`パターン**: wizard.tsxと同じChevronRight + group-open:rotate-90を踏襲
- **p5 vs 中央値 対比テーブル**: 重要年を間引き表示、暴落年・枯渇年をハイライト

### 計算根拠書

- **12セクション構成**: 収入と税金(5) / 資産の取り崩し(3) / シミュレーションの仕組み(4)
- **動的計算例**: 税エンジン関数を呼び出し、JSON設定変更に自動追従
- **スティッキー目次**: IntersectionObserverで現在セクションをハイライト
- **出典リンク**: 国税庁・厚労省・金融庁等の公式URL

### シナリオ管理

- 名前付きパラメータセット保存(localStorage)
- シナリオ比較画面(並列シミュレーション)
- JSON エクスポート / インポート

### 共有URL (v1.7.0)

- **DeflateRaw + Base64url圧縮**: pakoでFormStateを圧縮、URLフラグメント `#s=` に格納
- **サーバー不要**: 全データがURL内に完結
- **Web Share API / クリップボードフォールバック**: 「コピーしました」フィードバック
- **セキュリティ**: portfolio上隘8件、label上限50文字、numTrials固定1000、importFormFromJSONでバリデーション

### クイックスタート (v1.8.0)

- **3項目即座シミュレーション**: 年齢・年収・資産総額だけで即開始
- **デフォルト補完**: 省略フィールドはDEFAULT_FORMの合理的デフォルトで補完
- **詳しく設定する**: リンクでフルフォームに展開、入力値は自動反映

## アーキテクチャ

```
src/
├── App.tsx                    # 5フェーズステートマシン + 共有URL復元 + React.lazy
├── components/
│   ├── wizard.tsx             # オーケストレーター(~90行) + QuickStart統合
│   ├── wizard/                # セクション別サブコンポーネント
    │   ├── shared.tsx         # NumberInput, SliderInput
│   │   ├── quick-start.tsx    # 3項目クイックスタート
│   │   ├── scenario-section   # シナリオ管理 + エクスポート/インポート
│   │   ├── basic-section      # 年齢・年収・生活費
│   │   ├── portfolio-section  # 資産入力 + 合成計算 + 最適化
│   │   ├── income-section     # 年金・退職金・副収入
│   │   ├── events-section     # ライフイベント
│   │   ├── spouse-section     # 配偶者
│   │   └── advanced-section   # インフレ率・含み益率・シミュレーション回数
│   ├── results.tsx            # 1軍(成功率+チャート+最悪ケース) + 2軍(アクション折りたたみ) + What-if
│   ├── prescription-card.tsx  # 処方箋UI (lucide-react SVG)
│   ├── worst-case-card.tsx    # 最悪ケース診断書
│   ├── withdrawal-card.tsx    # 取り崩し最適化UI (v4.0)
│   ├── portfolio-optimizer.tsx # 最適化UI
│   ├── scenario-compare.tsx   # シナリオ比較
│   ├── theme-toggle.tsx       # ダーク/ライト切替 (Sun/Moon SVG)
│   ├── methodology/           # 計算根拠書 (12セクション)
│   │   ├── methodology-page.tsx
│   │   ├── sections/          # 各セクションコンポーネント
│   │   ├── table-of-contents.tsx
│   │   ├── progress-bar.tsx
│   │   └── example-card.tsx
│   └── ui/                    # shadcn/ui コンポーネント
├── lib/    ├── utils.ts               # cn(), formatManYen()│   ├── form-state.ts          # FormState永続化(v3スキーマ)
│   ├── url-share.ts           # 共有URL圧縮/展開 (DeflateRaw+Base64url)
│   ├── simulation/            # モンテカルロエンジン + Worker + diagnosis.ts
│   ├── tax/                   # 2026年度税制エンジン
│   ├── portfolio/             # 合成計算 + 最適化
│   ├── prescription/          # 処方箋(二分探索)
│   └── withdrawal/            # 取り崩し最適化
└── config/
    ├── asset-class-data.json  # 10資産クラス + 相関行列
    └── tax-config-2026.json   # 税率テーブル + 年金控除
```

### 技術スタック

- **Vite 6** + React 19 (SPA, SSRなし)
- **Tailwind CSS v4** + shadcn/ui (base-nova)
- **Web Worker**: モンテカルロをオフスレッド実行
- **Vitest**: 180テスト, ~2秒
- **Playwright**: E2E 4テスト (Chromium)
- **TypeScript 5 strict**: 全ファイル
- **ESLint 9** + typescript-eslint + eslint-plugin-react-hooks

### 依存関係ポリシー (v2.0.1)

**原則: 安定版を採用し、最前線を追わない。**

TypeScript 6 + ESLint 10 への同時メジャーバンプで以下の問題が発生した教訓に基づく:
- ESLint 10にTSパーサー未対応 → eslint.config.mjs全面書き直し
- eslint-plugin-react-hooks安定版がESLint 10未対応 → canary版を強制使用
- TypeScript 6のCSS import型宣言要件 → tsconfig.json修正
- 18件の未使用importが新規検出 → 12ファイル手動修正

#### バージョン選定基準

| 基準 | 説明 |
|------|------|
| エコシステム追従 | 主要プラグイン（eslint-plugin-react-hooks等）が安定版で対応済みであること |
| Breaking Change | 本プロジェクトが使用していない新機能のために破壊的変更を受け入れない |
| canary/rc禁止 | devDependenciesであっても不安定リリースチャネルは使用しない |
| tilde指定 | ツールチェーン系（typescript, eslint）はパッチのみ自動更新（`~`） |
| caret指定 | ランタイム系（react, recharts等）はマイナーまで自動更新（`^`） |

#### Dependabotルール

- **パッチ/マイナー**: 自動PR → CIグリーンなら速やかにマージ
- **メジャーバンプ**: typescript, eslint, vite, @types/node は `dependabot.yml` で ignore。手動評価時に以下を確認:
  1. 本プロジェクトが新機能を必要としているか
  2. 主要プラグインが新バージョンに対応済みか
  3. 移行ガイドの破壊的変更リストを確認

#### 現在の安定版ベースライン

| パッケージ | バージョン | 指定子 | 理由 |
|-----------|----------|--------|------|
| typescript | 5.9.x | `~5.9.3` | strict + bundler moduleResolutionで十分 |
| eslint | 9.x | `~9.39.4` | flat config対応、プラグインエコシステム安定 |
| eslint-plugin-react-hooks | 7.x | `^7.0.1` | ESLint 9対応安定版 |
| @types/node | 22.x | `^22` | CI Node.js 22と一致 |
| vite | 6.x | `^6.3.5` | 安定リリース |
| vite-tsconfig-paths | 5.x | `^5.1.4` | TS5対応安定版 |

### 設計原則

- **後方互換**: 新フィールドはすべてオプショナル、デフォルト値で既存動作を維持
- **エンジン分離**: `src/lib/` は純TypeScript、React非依存
- **FormState v4**: スキーマバージョン管理 + v2→v3→v4マイグレーション。v4で `withdrawalOrder?: TaxCategory[]` 追加
- **テスト駆動**: 税制計算・シミュレーション・最適化は独立テスト

### セキュリティ (v1.5.2)

- **CSP (Content Security Policy)**: `vite.config.ts` の `cspPlugin()` で本番ビルド時のみ `<meta>` タグを注入。`script-src 'self'`、`object-src 'none'`、`base-uri 'self'`、`form-action 'self'` 等の defense-in-depth ディレクティブ適用
- **GitHub Actions SHA-pin**: 全5アクションをコミットSHAで固定 (サプライチェーン攻撃防止)
- **Dependabot**: `github-actions` + `npm` エコシステムの週次自動更新
- **年齢整合性ガード**: retirementAge > currentAge, endAge > retirementAge を `formToSimulationInput()` で強制
- **年齢上限120歳**: endAge/retirementAge にキャップ (DoS防止)
- **numTrials上限10,000**: JSON import経由の過大値を防御
- **全拡張フィールド safeNum**: pension/sideIncome/lifeEvents/nisaConfig に NaN・負値ガード
- **共有URL圧縮サイズ上限**: 圧縮入力50KB・展開後500KB上限 (decompression bomb防御)
- **配列長上限**: portfolio≤20件、lifeEvents≤30件 (O(n²) DoS防御)
- **配偶者ガード**: spouseFormToInput に同等の整合性チェック

### デプロイ

- **GitHub Pages**: https://akiyoshi.github.io/fire-sanbo/
- **CI/CD**: GitHub Actions (`deploy.yml`) — test → E2E → build → deploy-pages (全アクション SHA-pinned)
- **Dependabot**: github-actions + npm の週次自動更新 (`dependabot.yml`)
- **OGP/Twitter Card**: `summary_large_image` + 1200×630 OGP画像
- **favicon**: SVG + 32px PNG + 180px Apple Touch Icon

---

## ロードマップ

### 完了済み

- [x] ~~GitHub Pages デプロイ~~ (v1.5.0)
- [x] ~~a11y基盤~~: aria-label, aria-hidden, role="alert", 色+アイコン二重伝達 (v1.5.0)
- [x] ~~emoji→SVG~~: lucide-react に全面移行 (v1.5.0)
- [x] ~~スティッキーCTA~~: 画面下部固定 + backdrop-blur (v1.5.0)
- [x] ~~OGP/Twitter Card~~: メタタグ + 画像 + favicon
- [x] ~~入力バリデーション強化~~: 年齢ガード + numTrialsキャップ + safeNum (v1.5.0)
- [x] ~~CSP + セキュリティ強化~~: ViteプラグインCSP, SHA-pin, Dependabot (v1.5.2)
- [x] ~~UI品質改善~~: 免責条項強化, 情報優先度修正, セマンティックトークン統一 (v1.6.0)
- [x] ~~a11y拡充~~: navランドマーク, skip-to-content, チャートaria-label, WCAG AAコントラスト (v1.6.0-1.6.1)
- [x] ~~コード品質~~: formatManYen一元化, 削除ボタンlucide-react統一 (v1.6.1)

- [x] ~~共有URL~~: DeflateRaw+Base64url圧縮でサーバーレス共有、Web Share API対応 (v1.7.0)
- [x] ~~クイックスタート~~: 3項目(年齢・年収・資産)で即座シミュレーション、結果ページアクション優先レイアウト (v1.8.0)
- [x] ~~品質・堅牢性~~: レスポンシブ(smブレークポイント), a11y(dialog/aria-modal/Esc), チャート高さ可変, OKLCHトークン統一 (v1.9.0)
- [x] ~~パフォーマンス・E2E~~: React.lazyコード分割(初期368KB, 49%削減), Playwright E2E 4テスト, CI E2Eゲート (v2.0.0)

### Phase 5: テンプレートシナリオ + UX品質 (v3.0)

CEOレビュー(拡大モード) + エンジニアリングレビュー + デザインプランレビューの結果を統合。

#### D1 テンプレートセレクター
- QuickStartとフルフォームの間に「あなたの状況に近いテンプレート」カード5枚
- テンプレート: 転職 / 住宅購入 / 教育費 / 早期退職 / 年金繰下げ
- `src/config/scenario-templates/` にJSONプリセット
- `applyTemplate(base, delta)` でFormStateにdelta適用
- 選択後、関連セクションが自動 `open` + 変更箇所ハイライト

#### D3 処方箋スケルトンUI
- `prescription-card.tsx` の `isLoading` 時に3行パルスアニメーション
- What-ifスライダー横に「計算中...」マイクロインジケーター
- 結果確定時にフェードイン

#### D4 チャートデータテーブル代替
- `results.tsx` のチャート直下に `<details><summary>データテーブルで見る</summary>`
- `<table>` で年齢×資産額(p5/p25/p50/p75/p95)を表示
- スクリーンリーダーユーザーがチャートデータに完全アクセス可能

#### D5 タッチターゲット44px監査
- ライフイベント削除ボタン、折りたたみシェブロン、テーマトグル等
- 全インタラクティブ要素を `min-h-[44px] min-w-[44px]` 以上に
- モバイルでのタップ精度向上

#### 税制年度切替基盤
- `src/config/tax-config-index.ts` で年度切替ロジック (`getTaxConfig(year)`)
- `SimulationInput` に `fiscalYear` フィールド追加
- 全税計算関数は既に `cfg` パラメータ対応済み (エンジン変更ゼロ)

### Phase 6: 税制年度更新 (v4.1 — 2027年1月)

- `tax-config-2027.json` 追加（年次の手動更新）
- 年度跨ぎ設計判断: **開始年度で全年固定** (将来の税制変更は反映しない旨を免責条項に明記)
- 基盤（`tax-config-index.ts`）は実装済み。JSON追加のみ

### メンテナンスモード（v4.0〜）

v4.0を実質完成版とする。以下のみ対応:
- 年次の税制JSON更新
- 依存関係のセキュリティパッチ
- バグ修正

以下は凍結:
- ~~PWA化~~ — 月1回のツールにService Workerは過剰
- ~~リブランド~~ — 1人ユーザーに名前変更のコストは不合理
- ~~BtoB検証~~ — 個人ツールの延長でBtoB検証は飛躍しすぎ
- ~~新機能追加~~ — 必要性が明確になるまで凍結
