# 🔥 FIRE参謀

> **ライブ**: https://akiyoshi.github.io/fire-sanbo/

ナビゲーション: **README** · [DESIGN](DESIGN.md) · [ARCHITECTURE](ARCHITECTURE.md) · [TODOS](TODOS.md) · [Archive](docs/archive/)

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
| テスト | Vitest (332テスト, ~10秒) + Playwright E2E (6テスト) |
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

## ドキュメント

| ファイル | 役割 |
|---------|------|
| [DESIGN.md](DESIGN.md) | ビジョン・原則・設計判断 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 現在の実装（コード地図・エンジン詳細・テスト構成） |
| [TODOS.md](TODOS.md) | 未着手の改善案（優先度付き） |
| [CHANGELOG.md](CHANGELOG.md) | 履歴アーカイブ |
| [AGENTS.md](AGENTS.md) | AI エージェント向けの作業ルール |
| [docs/archive/](docs/archive/) | 過去の大規模設計判断（履歴） |

プロジェクト構造の詳細は [ARCHITECTURE.md §11](ARCHITECTURE.md#11-ui-コンポーネント) を参照してください。

## ライセンス

個人プロジェクトとして公開。免責: 投資判断の責任はユーザーに帰属します。
