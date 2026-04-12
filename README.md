# 🔥 FIRE参謀

日本の税制・社会保険料を反映したモンテカルロFIREシミュレーター。

「成功確率67%」で終わらない — 支出削減・退職時期・追加投資の3軸で「90%にするには？」を逆算する処方箋エンジン搭載。

## 機能

- **モンテカルロシミュレーション** — 1,000回の確率的試行で成功率を算出
- **日本の税制エンジン** — 所得税・住民税・社会保険料・iDeCo退職所得控除・特定口座譲渡益税・金現物譲渡税を反映
- **処方箋エンジン** — 目標成功率に対して3軸で二分探索し、Top 3の改善案を提示
- **4口座種別** — NISA / 特定口座 / iDeCo / 金現物の取り崩し順序を最適化
- **ポートフォリオ・ブリッジ** — 8資産クラス＋現金の保有額から合成リターン・リスクを自動計算（GPIF相関行列ベース）
- **What-ifスライダー** — 結果画面でリアルタイムにパラメータを変更して再計算
- **インフレ率対応** — 実質リターン＝名目リターン−インフレ率

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Vite + React 19 (SPA) |
| スタイル | Tailwind CSS v4 + shadcn/ui |
| 計算 | Web Worker (メインスレッドブロッキング回避) |
| テスト | Vitest + Testing Library (86テスト) |
| 言語 | TypeScript (strict) |

## セットアップ

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest 実行
npm run build      # 本番ビルド → dist/
```

## プロジェクト構造

```
src/
├── App.tsx              # エントリポイント
├── main.tsx             # ReactDOM.createRoot
├── app/globals.css      # Tailwind + テーマ変数
├── components/          # UI コンポーネント
│   ├── wizard.tsx       # 入力フォーム
│   ├── results.tsx      # 結果画面 + What-if
│   ├── prescription-card.tsx
│   ├── tax-breakdown-card.tsx
│   └── ui/              # shadcn/ui
├── config/              # 税制・資産クラスデータ (JSON)
└── lib/                 # 計算エンジン (フレームワーク非依存)
    ├── simulation/      # モンテカルロ + Worker
    ├── prescription/    # 処方箋 (二分探索)
    ├── tax/             # 税制エンジン
    ├── portfolio/       # ポートフォリオ合成
    └── withdrawal/      # 取り崩し順序最適化
```
