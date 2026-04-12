# FIRE参謀 — Vite移行 デザインドキュメント

> **ステータス**: Approved
> **スプリント**: Sprint 6 (緊急)
> **前提**: v0.6.0 (処方箋機能完成済み) — 開発環境がクラッシュし開発継続不能

## 概要

Next.js 16 を撤去し、Vite + React SPA に移行する。計算エンジン・UIコンポーネントはそのまま保持し、フレームワーク層のみ差し替える。

## 問題

Next.js 16 の devサーバー（Turbopack/SWC）が node.exe で20GBのメモリを消費し、ブラウザとVSCodeがクラッシュする。入力フォームの操作すら不可能で、開発が完全に停止している。

- `--max-old-space-size=512` はV8ヒープのみ制限し、Turbopackのネイティブ（Rust）メモリには効かない
- 全コンポーネントが `"use client"` — SSR/RSC/API Routesの利用ゼロ
- 個人用SPAにSSRフレームワークは不要

## ターゲットユーザー

開発者自身（個人用FIREシミュレーター）

## 提案するアプローチ

### Vite + React SPA への移行

Next.js固有のインフラを撤去し、Viteに差し替える。

#### 変更マトリクス

| レイヤー | 変更内容 |
|---------|---------|
| `src/lib/**` (計算エンジン全体) | **変更ゼロ** |
| `src/config/**` (税制・資産クラスデータ) | **変更ゼロ** |
| `src/components/ui/**` (shadcn) | **変更ゼロ** |
| `src/components/*.tsx` (wizard, results等) | `"use client"` ディレクティブ削除のみ |
| `src/app/page.tsx` → `src/App.tsx` | Next.jsルーティング除去 → 単一エントリポイント |
| `src/app/layout.tsx` → `index.html` | HTMLシェルを手書き |
| `src/app/globals.css` | **変更ゼロ** (パス変更のみ) |
| `vitest.config.ts` | **変更ゼロ** (既にVitest) |
| `next.config.ts` → `vite.config.ts` | 新規作成 |
| `package.json` | next削除、vite追加 |

#### 新規ファイル

| ファイル | 内容 |
|---------|------|
| `vite.config.ts` | Vite設定 (react plugin, tsconfig paths, worker設定) |
| `index.html` | エントリHTML (`<div id="root">` + `<script type="module" src="/src/main.tsx">`) |
| `src/main.tsx` | ReactDOM.createRoot エントリポイント |
| `src/App.tsx` | 現在の `page.tsx` のロジックを移植 |

#### 削除ファイル

| ファイル | 理由 |
|---------|------|
| `next.config.ts` | Next.js固有 |
| `next-env.d.ts` | Next.js型定義 |
| `src/app/page.tsx` | `App.tsx` に統合 |
| `src/app/layout.tsx` | `index.html` に統合 |

#### パッケージ変更

**追加:**
- `vite`
- `@vitejs/plugin-react`
- `vite-tsconfig-paths`

**削除:**
- `next`
- `eslint-config-next`

**保持 (変更なし):**
- `react`, `react-dom` (19.x)
- `recharts`, `lucide-react`, `next-themes` → `next-themes` は要差し替え検討
- `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css`
- `shadcn`, `class-variance-authority`, `clsx`, `tailwind-merge`
- `vitest`, `@testing-library/*`, `jsdom`
- `typescript`, `@types/*`

#### next-themes の扱い

`next-themes` は Next.js 非依存で動作する（内部的には React Context のみ）。Vite環境でもそのまま動く。ただし将来的に依存を減らしたい場合は、10行程度の自前実装で置き換え可能。初回移行ではそのまま保持。

#### Web Worker の互換性

Vite は `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` パターンをネイティブサポート。現在の `SimulationWorker` クラスのWorker生成部分のみ確認・調整が必要。

## 技術的考慮事項

### パスエイリアス `@/`

現在 `tsconfig.json` で `@/*` → `./src/*` を定義。`vite-tsconfig-paths` プラグインで自動解決されるため、全ソースの `@/` インポートは変更不要。

### Tailwind CSS v4

Tailwind v4 は PostCSS プラグインとして動作。`postcss.config.mjs` はそのまま。Vite は PostCSS をネイティブサポートするため設定変更不要。

### ビルド・デプロイ

| 項目 | Before (Next.js) | After (Vite) |
|------|------------------|-------------|
| dev | `next dev` (Turbopack, ~20GB) | `vite dev` (~100-200MB) |
| build | `next build` (SSR + CSR) | `vite build` (CSRのみ) |
| output | `.next/` | `dist/` |
| serve | `next start` (Node.js必須) | 任意の静的サーバー |

### Playwright E2Eテスト

`package.json` に `test:e2e` がある。Vite の devサーバーURLに変更するだけで動作する想定。

## 成功指標

| 指標 | 目標値 | 現状 |
|------|--------|------|
| devサーバーのメモリ使用量 | < 500MB | ~20GB |
| devサーバー起動 → 操作可能 | < 5秒 | クラッシュ |
| 入力フォームの操作 | フリーズなし | クラッシュ |
| VSCodeクラッシュ | ゼロ | 頻発 |
| 計算エンジンのコード変更 | ゼロ行 | — |
| テスト (vitest) の通過 | 全パス | — |

## スコープ外

- 計算エンジンの変更・最適化
- UI/UXの変更
- 新機能の追加
- SSR/SSGの導入
- ルーティングの追加（単一ページのまま）

## 工数見積もり

| 作業 | 見積もり |
|------|---------|
| Vite設定 + エントリファイル作成 | 15分 |
| page.tsx → App.tsx 移植 | 10分 |
| layout.tsx → index.html 移植 | 5分 |
| `"use client"` ディレクティブ除去 | 5分 |
| Worker互換性確認・調整 | 15分 |
| package.json更新 + npm install | 10分 |
| テスト実行・修正 | 15分 |
| devサーバー起動・動作確認 | 10分 |
| **合計** | **~1.5時間** |

## リスク

| リスク | 対策 |
|--------|------|
| next-themes がViteで動かない | 10行の自前実装に差し替え |
| Worker生成パターンの差異 | Viteの`?worker`サフィックスまたはURL pattern |
| shadcn CLIがNext.js前提 | 既に生成済みのコンポーネントは影響なし。今後の追加時は手動コピー |
