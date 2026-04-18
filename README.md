# 🔥 FIRE参謀

> **ライブ**: https://akiyoshi.github.io/fire-sanbo/

日本の税制・社会保険料を反映したモンテカルロFIREシミュレーター。

「成功確率67%」で終わらない — 支出削減・退職延期・収入増加・アロケーション最適化の4軸で「90%にするには？」を逆算する処方箋エンジン搭載。

## 機能

- **モンテカルロシミュレーション** — 1,000回の確率的試行で成功率を算出
- **日本の税制エンジン** — 所得税・住民税・社会保険料・iDeCo退職所得控除・特定口座譲渡益税・金現物譲渡税を反映（2026年度税制対応）
- **処方箋エンジン** — 目標成功率に対して4軸（支出・退職・収入・資産配分）で改善案を提示、アロケーション処方箋はワンクリック適用
- **最悪ケース診断書** — p5（下位5%）シナリオを分析し、暴落型・資金不足型・長寿リスク型等に自動分類
- **5口座種別** — 現金 / NISA / 特定口座 / iDeCo / 金現物の取り崩し順序を最適化、全パターン評価でワンクリック適用
- **含み益動的追跡** — 特定口座・金現物の取得費(costBasis)を年次追跡、積立・リターン・取り崩し・リバランスで動的に含み益率を算出
- **ポートフォリオ最適化** — 効率的フロンティア(モンテカルロ10,000サンプル)で最適配分を提案、保有に適用 or 目標に設定
- **目標アセットアロケーション** — 資産クラスレベルの目標配分を入力、積立時・退職後のリバランスを自動実行
- **計算根拠書** — 15セクション・4グループ・動的計算例・出典リンク付きで全ルールを解説
- **What-ifスライダー** — 結果画面でリアルタイムにパラメータを変更して再計算
- **シナリオ管理** — 名前付き保存・比較・JSON エクスポート/インポート、結果画面からも保存可能
- **共有URL** — DeflateRaw+Base64url圧縮でサーバーレス共有、Web Share API対応
- **はじめにガイド** — ツールの背景と使い方を5ステップのチュートリアル形式で提供

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Vite 6 + React 19 (SPA) |
| スタイル | Tailwind CSS v4 + shadcn/ui (OKLCH) |
| アイコン | lucide-react (SVG) |
| 計算 | Web Worker (メインスレッドブロッキング回避) |
| テスト | Vitest (269テスト, ~2秒) + Playwright E2E (4テスト) |
| 言語 | TypeScript 5 (strict) |
| 品質 | ESLint 9 + typescript-eslint + react-hooks |
| CI/CD | GitHub Actions → GitHub Pages |

## セットアップ

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest 実行
npm run test:e2e   # playwright E2Eテスト
npm run build      # 本番ビルド → dist/
```

## プロジェクト構造

```
src/
├── App.tsx              # エントリポイント (6フェーズステートマシン + React.lazy)
├── main.tsx             # ReactDOM.createRoot
├── app/globals.css      # Tailwind + テーマ変数 (OKLCH)
├── components/          # UI コンポーネント
│   ├── wizard.tsx       # 入力フォーム + CollapsibleCardセクション
│   ├── wizard/          # セクション別入力 + 目標アロケーションUI
│   ├── results.tsx      # 結果画面 + What-if + シナリオ保存
│   ├── guide-page.tsx   # はじめにガイド（チュートリアル）
│   ├── prescription-card.tsx  # 処方箋
│   ├── worst-case-card.tsx    # 最悪ケース診断書
│   ├── portfolio-optimizer.tsx # 効率的フロンティア
│   ├── scenario-compare.tsx   # シナリオ比較
│   ├── methodology/     # 計算根拠書 (15セクション・4グループ)
│   └── ui/              # shadcn/ui
├── config/              # 税制・資産クラスデータ (JSON) + テンプレート + 年度切替
└── lib/                 # 計算エンジン (フレームワーク非依存)
    ├── url-share.ts     # 共有URL圧縮/展開
    ├── simulation/      # モンテカルロ + Worker + 診断 + costBasis追跡 + 口座ヘルパー
    ├── prescription/    # 処方箋 (二分探索)
    ├── tax/             # 税制エンジン
    ├── portfolio/       # ポートフォリオ合成 + 最適化
    └── withdrawal/      # 取り崩し順序最適化
```
