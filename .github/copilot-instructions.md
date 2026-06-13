<!-- inherits: gstack-copilot-jp v1.0.0.0 (.github/skills, .github/agents, .github/hooks are junctions) -->
<!-- project: fire-sanbo (Vite 6 + React 19 SPA, FIRE simulator) -->

# fire-sanbo development

日本の税制を組み込んだモンテカルロ FIRE シミュレーター。
[gstack-copilot-jp](https://github.com/akiyoshi/gstack-copilot-jp) のスキル/エージェント/フックを `.github/` 配下にジャンクションリンクして利用する。

## 言語

このプロジェクトは日本語ファーストで進める。

- ユーザーへの応答は常に日本語で行う
- スキル、ツール、プロンプト、外部ドキュメントが英語で書かれていても、作業の結論とユーザー向け出力は日本語にする
- **SKILL.md 内の ask_user の質問文・選択肢テキストも日本語に翻訳して表示する**
- **英語のスキル指示を読んでも、ユーザーに見せるテキストは全て日本語にする。英語テキストをそのまま表示しない**
- スキルのデフォルト言語がこのルールを上書きしないこと

## スキルルーティング

リクエストが利用可能なスキルに一致する場合 → **必ず該当スキルを最初に呼び出す。**
直接回答したり、他のツールを先に使ったりしない。

| ユーザーの意図 | 呼び出すスキル |
|---|---|
| プロダクトのアイディア、「これ作る価値ある？」 | `/office-hours` |
| 戦略レビュー、スコープ、野心度 | `/plan-ceo-review` |
| アーキテクチャレビュー、データフロー | `/plan-eng-review` |
| デザインレビュー、UI/UX | `/plan-design-review` |
| 開発者体験、オンボーディング、API設計 | `/plan-devex-review` |
| 全レビューを一括で | `/autoplan` |
| デザイン相談、ブランド構築 | `/design-consultation` |
| デザイン案を複数見たい | `/design-shotgun` |
| デザインをHTMLに変換 | `/design-html` |
| コードレビュー、diff確認 | `/gstack-review` |
| デザイン実装レビュー | `/design-review` |
| DX実装レビュー | `/devex-review` |
| バグ、エラー、「なぜ壊れた？」 | `/investigate` |
| QA、テスト実行 | `/qa` |
| QAレポートのみ（修正なし） | `/qa-only` |
| セキュリティ監査、脆弱性 | `/cso` |
| パフォーマンス計測 | `/benchmark` |
| モデル比較、どのモデルがいい | `/benchmark-models` |
| コード品質ダッシュボード | `/health` |
| リリース、PR作成 | `/ship` |
| マージ＆デプロイ | `/land-and-deploy` |
| デプロイ後の監視 | `/canary` |
| 週次振り返り | `/retro` |
| ドキュメント更新 | `/document-release` |
| PDF作成、markdownをPDFに | `/make-pdf` |
| 学習記録の管理 | `/learn` |
| セッション振り返り | `/learn 振り返り` |
| 「慎重にやって」、安全モード | `/careful` |
| ファイル編集を制限 | `/freeze` |
| フル安全モード | `/guard` |
| 制限解除 | `/unfreeze` |
| ブラウザで開く、サイトテスト | `/browse` |
| ブラウザCookieインポート | `/setup-browser-cookies` |
| 可視ブラウザ起動 | `/open-gstack-browser` |
| エージェント連携、ブラウザ共有 | `/pair-agent` |
| デプロイ環境の設定 | `/setup-deploy` |
| アップグレード | `/gstack-upgrade` |
| セッション保存 | `/context-save` |
| セッション復帰、どこまでやったっけ | `/context-restore` |

## プロジェクト概要

**Vite 6 + React 19 SPA**（SSR/RSC なし）。

- フレームワーク: Vite 6（dev / build）+ React 19
- スタイル: Tailwind CSS v4 + shadcn/ui (OKLCH トークン)
- テスト: Vitest（293 テスト）+ Playwright E2E（6 テスト）
- 計算エンジン: [src/lib/](src/lib/) 以下（純 TypeScript、フレームワーク非依存）
- Web Worker: [src/lib/simulation/worker.ts](src/lib/simulation/worker.ts)
- パスエイリアス: `@/` → `./src/*`
- バージョン: `package.json` を Single Source of Truth

## Commands（fire-sanbo 固有）

```bash
npm test              # vitest run（コミット前に必ず実行）
npm run test:watch    # vitest watch モード
npm run test:e2e      # Playwright E2E
npm run lint          # eslint
npm run dev           # Vite dev server
npm run build         # tsc -b && vite build
npm run preview       # ビルド結果の確認
```

スキル（`/qa`, `/ship`, `/benchmark` 等）はこれらのコマンドを使う。
**スキルがハードコードされたコマンド（`bun test` 等）を出した場合は、上記の `npm` 系に読み替える。**

## ドキュメント構造（必読順）

| ファイル | 役割（Diátaxis 分類） | 用途 |
|---------|--------------------|------|
| [README.md](../README.md) | Tutorial 入り口 | 機能概要・セットアップ |
| [AGENTS.md](../AGENTS.md) | エージェントルール | 役割・命名規約・禁止事項 |
| [DESIGN.md](../DESIGN.md) | Explanation | ビジョン・原則・設計判断 |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Reference | 現在の実装の地図 |
| [TODOS.md](../TODOS.md) | How-to | 未着手の改善案（優先度付き） |
| [CHANGELOG.md](../CHANGELOG.md) | History | 履歴アーカイブ（**能動更新なし** — git log を参照） |
| [docs/archive/](../docs/archive/) | History | 過去の大規模設計判断 |

**作業前に AGENTS.md を必ず読む。** テストヘルパー命名規約・配置・禁止事項が記載されている。

## ドキュメント更新ルール（Update Docs with Code）

**コードと同じコミットでドキュメントを更新する。** 乖離はバグと同等。

| 変更内容 | 更新が必要なドキュメント |
|---------|---------------------|
| 新機能の追加 | ARCHITECTURE.md（実装地図）+ DESIGN.md（採用理由が新規の場合のみ） |
| 設計判断の変更 | DESIGN.md（理由を更新） |
| 内部リファクタ | ARCHITECTURE.md（影響箇所のみ） |
| TODOS.md 着手 | ステータス変更、完了時はエントリ削除（履歴は git log） |
| テスト追加 | ARCHITECTURE.md §12 のテスト数を更新 |
| 依存関係のメジャーバンプ評価 | DESIGN.md / ARCHITECTURE.md §15 |

**禁止事項:**
- DESIGN.md に「実装済み機能リスト」を再追加しない（ARCHITECTURE.md と重複）
- ARCHITECTURE.md に「採用理由」を書かない（DESIGN.md にリンク）
- 同じ情報を複数ファイルに書かない（リンクで参照）
- ルートに新しい `DESIGN-*.md` を作らない（過去判断は `docs/archive/`）

## コーディング規約

- TypeScript strict モード
- ESLint flat config（`~9.39.4` 系で固定、メジャーバンプ禁止）
- 計算ロジックは React 非依存に保つ（テスト容易性）
- 新フィールドはオプショナル + デフォルト値で後方互換を維持
- FormState スキーマ変更時は `storage.ts` のマイグレーションを追加

## テストヘルパー命名規約（AGENTS.md より）

| 用途 | プレフィックス | 例 |
|------|---------------|----|
| テストデータ生成 | `create*()` | `createSimulationInput()` |
| 共通アサーション | `expect*()` | `expectPercentilesOrdered()` |
| URL/文字列組み立て | `build*()` | `buildShareHash()` |

**禁止:** `make*()` 系の命名（過去の `makeAccts` / `makeYear` は廃止）

配置:
- ファクトリ関数: [src/lib/test-utils/fixtures.ts](../src/lib/test-utils/fixtures.ts)
- アサーション関数: [src/lib/test-utils/assertions.ts](../src/lib/test-utils/assertions.ts)
- import: `import { createSimulationInput } from "@/lib/test-utils";`
- `src/lib/test-utils/` は **テストファイルからのみ** import 可（本番コードからの参照禁止）

## 依存ポリシー（v2.0.1〜）

- **安定版のみ**（canary/rc は devDeps でも禁止）
- **ツールチェーン系**（typescript, eslint）: tilde `~` でパッチのみ自動更新
- **ランタイム系**（react 等）: caret `^` でマイナーまで
- **Dependabot**: TS/ESLint/Vite/@types/node のメジャーバンプは ignore（手動評価）
- **ESLint config**: Flat config 配列（ESLint 9 形式）、`defineConfig()` は使わない

## バージョニング

- 現在のバージョンは `package.json` を参照（このファイルにハードコードしない）
- パッチ: バグ修正・ドキュメント整理
- マイナー: 機能追加・スキーマ拡張
- メジャー: 採用していない（破壊的変更を避ける方針）
- **CHANGELOG.md の能動更新は行わない**（git log + git tag で参照）
  - `/ship` スキルが CHANGELOG 生成を提案してもスキップする

## SKILL.md ワークフロー（gstack-copilot-jp 共有）

スキル本体は `.github/skills/<skill-name>/SKILL.md` にある（gstack-copilot-jp へのジャンクション）。
**これらは fire-sanbo 側で編集しない。** 編集が必要な場合は `d:\github\gstack-copilot-jp\.github\skills/...` を直接編集する。

エージェント定義 (`.github/agents/*.agent.md`) も同様。

## Browser interaction

ブラウザ操作（QA、ドッグフーディング）は `/browse` スキルを使う。
`browse` バイナリは gstack-copilot-jp 側でビルドされたものを共有する:

```bash
eval "$(d:/github/gstack-copilot-jp/bin/gstack-env)"
```

## コミットスタイル

- **Conventional Commits**: `<type>(<scope>): <description>`（feat / fix / test / refactor / docs / chore / style / perf）
- **Bisect コミット** — 1 コミット = 1 論理的変更
- **`git add .` / `git add -A` 禁止** — 必ずファイル名を指定
- PR diffs は 300 行以下を目標

## 長時間タスク

テストや長時間バックグラウンドタスクは **完了までポーリング**。
「終わったら通知します」と言って止めない。完了かユーザー停止指示があるまで進捗報告を続ける。

## 検索してから作る

並行処理・未知のパターン・インフラ・ランタイム組み込み機能の可能性がある場合:

1. 「{ランタイム} {対象} built-in」で検索
2. 「{対象} best practice {現在の年}」で検索
3. 公式ドキュメントを確認

3層の知識: tried-and-true (Layer 1) / new-and-popular (Layer 2) / first-principles (Layer 3)。
Layer 3 を最も重視する。詳細は gstack-copilot-jp の ETHOS.md を参照。
