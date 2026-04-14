# FIRE参謀 — 人生の資産設計エンジン（日本版）

> **バージョン**: v1.6.0
> **更新日**: 2026-04-14
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
| 取り崩し最適化 | `withdrawal/optimizer.ts` | 6テスト |
| ポートフォリオ合成 | `portfolio/engine.ts` | 10テスト |
| ポートフォリオ最適化 | `portfolio/optimizer.ts` | 13テスト |
| FormState永続化 + バリデーション | `form-state.ts` | 33テスト |
| **合計** | | **147テスト** |

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

## アーキテクチャ

```
src/
├── App.tsx                    # 4フェーズステートマシン
├── components/
│   ├── wizard.tsx             # オーケストレーター(~90行)
│   ├── wizard/                # セクション別サブコンポーネント
│   │   ├── shared.tsx         # NumberInput, SliderInput, format関数
│   │   ├── scenario-section   # シナリオ管理 + エクスポート/インポート
│   │   ├── basic-section      # 年齢・年収・生活費
│   │   ├── portfolio-section  # 資産入力 + 合成計算 + 最適化
│   │   ├── income-section     # 年金・退職金・副収入
│   │   ├── events-section     # ライフイベント
│   │   ├── spouse-section     # 配偶者
│   │   └── advanced-section   # インフレ率・含み益率・シミュレーション回数
│   ├── results.tsx            # 成功率 + チャート + What-if
│   ├── prescription-card.tsx  # 処方箋UI (lucide-react SVG)
│   ├── worst-case-card.tsx    # 最悪ケース診断書
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
├── lib/
│   ├── form-state.ts          # FormState永続化(v3スキーマ)
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
- **Vitest**: 147テスト, ~2秒
- **TypeScript strict**: 全ファイル

### 設計原則

- **後方互換**: 新フィールドはすべてオプショナル、デフォルト値で既存動作を維持
- **エンジン分離**: `src/lib/` は純TypeScript、React非依存
- **FormState v3**: スキーマバージョン管理 + v2→v3マイグレーション
- **テスト駆動**: 税制計算・シミュレーション・最適化は独立テスト

### セキュリティ (v1.5.2)

- **CSP (Content Security Policy)**: `vite.config.ts` の `cspPlugin()` で本番ビルド時のみ `<meta>` タグを注入。`script-src 'self'`、`object-src 'none'`、`base-uri 'self'`、`form-action 'self'` 等の defense-in-depth ディレクティブ適用
- **GitHub Actions SHA-pin**: 全5アクションをコミットSHAで固定 (サプライチェーン攻撃防止)
- **Dependabot**: `github-actions` + `npm` エコシステムの週次自動更新
- **年齢整合性ガード**: retirementAge > currentAge, endAge > retirementAge を `formToSimulationInput()` で強制
- **年齢上限120歳**: endAge/retirementAge にキャップ (DoS防止)
- **numTrials上限10,000**: JSON import経由の過大値を防御
- **全拡張フィールド safeNum**: pension/sideIncome/lifeEvents/nisaConfig に NaN・負値ガード
- **配偶者ガード**: spouseFormToInput に同等の整合性チェック

### デプロイ

- **GitHub Pages**: https://akiyoshi.github.io/fire-sanbo/
- **CI/CD**: GitHub Actions (`deploy.yml`) — test → build → deploy-pages (全アクション SHA-pinned)
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

### Phase 1: バイラル装置 (次の優先)

- [ ] **共有URL**: パラメータをBase64エンコード → URLフラグメント、サーバー不要
  - 処方箋結果ページからワンクリックでURL生成
  - 「私のFIRE計画を見て」がTwitterで回る装置

### Phase 2: Time to Value 革命

- [ ] **プログレッシブ入力**: 3項目(年齢・年収・資産)で即座に概算結果表示
  - 現在20項目のフォームは初見離脱率が高い
  - Step 1: 3項目 → 即概算 / Step 2: 詳細入力 / Step 3: 高度な設定
- [ ] **結果ページ再構成**: KPI → 処方箋(アクション) → チャート+What-if の順
  - 成功率だけ見て離脱するユーザーを処方箋に誘導

### Phase 3: 品質・堅牢性

- [ ] **WCAG AA完全準拠**: チャート代替テキスト、色+アイコン二重伝達の残り、コントラスト比4.5:1
- [ ] **フルレスポンシブ**: mdブレークポイント追加、チャート高さ可変、タブレット2カラム
- [ ] **デザイントークン統一**: OKLCH変数 → 全コンポーネント浸透、ダーク/ライト完全対称

### Phase 4: パフォーマンス・テスト

- [ ] recharts遅延ロード: React.lazyでバンドルサイズ削減 (現在752KB gzip 227KB)
- [ ] E2Eテスト: Playwright で入力→結果→処方箋→シナリオ比較フロー検証

### 将来構想 (CEOレビューより)

- [ ] **名前遷移**: FIRE参謀 → 資産参謀 (FIRE以外のユーザー層拡大時)
- [ ] **動的OGP**: シミュレーション結果をOGP画像に反映 (Edge Function)
- [ ] **PWA対応**: オフライン実行、ホーム画面追加
