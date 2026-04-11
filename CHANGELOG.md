# Changelog

## [0.2.0] - 2026-04-11

### 修正
- ファンチャートを信頼区間帯 (band90/band50) に修正
- チャートカラー hsl(var(--chart-1)) → var(--chart-1) (oklch対応)
- What-if スライダーの stale closure レース修正 (generation counter)
- Worker pending 上書き防止 + cancel() 後のハンドラ再登録
- What-if debounce 300ms 追加
- 退職後の社会保険料 (国保+国民年金) を支出に加算
- seed をランダム化 (毎回異なるシミュレーション結果)
- retirementAge 変更時に endAge を自動 clamp
- NumberInput 金額上限追加 (Infinity 防止)

### 追加
- Web Worker 統合 (メインスレッドブロッキング解消)
- 初回計算のローディングスピナー
- 再計算中のオーバーレイ表示
- 成功確率に解釈テキスト追加 (90%以上=非常に安全 etc)
- ウィザード入力バリデーション (年齢整合性、口座残高)
- 金額入力にカンマ区切り + 万円換算表示
- チャートカラーをグレースケールから青系に変更 (ライト/ダーク)
- NaN 防御 (formToSimulationInput に safeNum() 追加)
- テスト追加: optimizer 5件、form-state 8件 (30→43テスト)

## [0.1.0] - 2026-04-11

### 初回リリース
- モンテカルロ FIRE シミュレーション (1,000-10,000 試行)
- 日本税制エンジン (所得税7段階、住民税、社保、NISA/特定/iDeCo)
- 口座別取り崩し最適化 (全6パターン評価)
- What-if 分析スライダー
- ウィザード形式入力 UI (4ステップ)
- ダーク/ライトテーマ切替
- 30 テスト (税制19件、シミュレーション11件)
