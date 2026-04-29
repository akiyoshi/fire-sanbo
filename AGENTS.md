# FIRE参謀 — エージェントルール

> 人間向け入り口: [README.md](README.md)

## プロジェクト概要

**Vite 6 + React 19 SPA**（SSR/RSC なし）。日本の税制を組み込んだモンテカルロ FIRE シミュレーター。

- フレームワーク: Vite 6（dev / build）+ React 19
- スタイル: Tailwind CSS v4 + shadcn/ui (OKLCH トークン)
- テスト: Vitest（293 テスト）+ Playwright E2E（6 テスト）
- 計算エンジン: [src/lib/](src/lib/) 以下（純 TypeScript、フレームワーク非依存）
- Web Worker: [src/lib/simulation/worker.ts](src/lib/simulation/worker.ts)
- テーマ: next-themes（Next.js 非依存で動作）
- パスエイリアス: `@/` → `./src/*`

## ドキュメント構造（必読順）

エージェントは作業前に以下のドキュメントを参照し、役割に応じた更新を行ってください。

| ファイル | 役割（Diátaxis 分類） | 用途 |
|---------|--------------------|------|
| [README.md](README.md) | Tutorial 入り口 | 機能概要・セットアップ |
| [DESIGN.md](DESIGN.md) | Explanation | ビジョン・原則・設計判断 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Reference | 現在の実装の地図 |
| [TODOS.md](TODOS.md) | How-to | 未着手の改善案（優先度付き） |
| [CHANGELOG.md](CHANGELOG.md) | History | 履歴アーカイブ（能動更新なし） |
| [docs/archive/](docs/archive/) | History | 過去の大規模設計判断 |

## ドキュメント更新ルール（Update Docs with Code）

**コードと同じコミットでドキュメントを更新してください。** 乖離はバグと同等に扱います。

| 変更内容 | 更新が必要なドキュメント |
|---------|---------------------|
| 新機能の追加 | ARCHITECTURE.md（実装地図）+ DESIGN.md（採用理由が新規の場合のみ） |
| 設計判断の変更 | DESIGN.md（理由を更新） |
| 内部リファクタ | ARCHITECTURE.md（影響箇所のみ） |
| TODOS.md の項目を着手 | TODOS.md でステータス変更、完了したら「完了済み」セクションへ移動 |
| テスト追加 | ARCHITECTURE.md §12 のテスト数を更新 |
| 依存関係のメジャーバンプ評価 | DESIGN.md / ARCHITECTURE.md §15 のチェックリスト |
| 凍結項目の再開 / 新規凍結 | TODOS.md の凍結セクション |

**禁止事項**:
- DESIGN.md に「実装済み機能リスト」を再追加しない（ARCHITECTURE.md と重複するため）
- ARCHITECTURE.md に「採用理由」を書かない（DESIGN.md にリンクすること）
- 同じ情報を複数ファイルに書かない（Duplication is Evil — リンクで参照する）
- ルートに新しい `DESIGN-*.md` を作らない（過去判断は [docs/archive/](docs/archive/) へ）

## コーディング規約

- TypeScript strict モード
- ESLint flat config（`~9.39.4` 系で固定、メジャーバンプ禁止）
- 計算ロジックは React 非依存に保つ（テスト容易性のため）
- 新フィールドはオプショナル + デフォルト値で後方互換を維持
- FormState スキーマ変更時は `storage.ts` のマイグレーションを追加

## テストコード規約

テストヘルパーの命名と配置は以下に従ってください。違反した場合 PR レビューで差し戻されます。

### 命名

| 用途 | プレフィックス | 例 |
|------|---------------|----|
| テストデータ生成（オブジェクト/複合データ） | `create*()` | `createSimulationInput()`, `createMemberAccounts()` |
| 共通アサーション | `expect*()` | `expectPercentilesOrdered()`, `expectInRange()` |
| URL/文字列など組み立てが複雑な値 | `build*()` | `buildShareHash()` |

**禁止:**
- `make*()` 系の命名（過去の `makeAccts` / `makeYear` / `makeAccounts` は廃止）
- テストファイルごとに同等の fixture を再定義すること

### 配置

- ファクトリ関数 (`create*`) は [src/lib/test-utils/fixtures.ts](src/lib/test-utils/fixtures.ts)
- アサーション関数 (`expect*`) は [src/lib/test-utils/assertions.ts](src/lib/test-utils/assertions.ts)
- インポート: `import { createSimulationInput } from "@/lib/test-utils";`
- `src/lib/test-utils/` は **テストファイルからのみ** import する（本番コードからの参照禁止）

### 既定値の方針

- `createSimulationInput()` の既定値は「働き世代の個人 FIRE」を想定した中庸な値
- テスト固有の差分は `overrides` で明示的に上書きする（既定値に依存しすぎない）
- ファイルローカルに 2 ヶ所以上同じ overrides を書く場合は、ファイル内ヘルパー（例: `function baseInput(o) { return createSimulationInput({ numTrials: 200, ...o }); }`）として 1 度だけラップする

## バージョニング

- 現在: v4.5.8（[package.json](package.json#L3)）
- パッチ: バグ修正・ドキュメント整理
- マイナー: 機能追加・スキーマ拡張
- メジャー: 採用していない（破壊的変更を避ける方針）

ユーザー指定により `CHANGELOG.md` の能動更新は行いません（git log + git tag で参照）。
