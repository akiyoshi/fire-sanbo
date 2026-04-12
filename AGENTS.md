# FIRE参謀 — エージェントルール

このプロジェクトは **Vite + React 19 SPA** です（SSR/RSCなし）。

- フレームワーク: Vite (dev/build) + React 19
- スタイル: Tailwind CSS v4 + shadcn/ui
- テスト: Vitest + Testing Library
- 計算エンジン: `src/lib/` 以下（純TypeScript、フレームワーク非依存）
- Web Worker: `src/lib/simulation/worker.ts`（モンテカルロシミュレーション）
- テーマ: next-themes（Next.js非依存で動作）
- パスエイリアス: `@/` → `./src/*`
