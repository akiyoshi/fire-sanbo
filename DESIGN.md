# FIRE参謀 — 人生の資産設計エンジン（日本版）

> **バージョン**: v0.9 設計
> **前提**: v0.8.0 (Vite SPA + シナリオ管理) が完成済み

## ビジョン

**日本の税制・社会保障を正確に組み込んだ、個人向けライフタイム資産シミュレーター。**

FIRE計算機を超え、年金・退職金・ライフイベント・世帯収支・ポートフォリオ最適化を統合した
「人生の資産設計エンジン」として再定義する。

## 現在の限界

| 項目 | 現状 | 問題 |
|------|------|------|
| 収入モデル | 退職前=給与、退職後=0 | 年金・副収入・退職金がない |
| 支出モデル | 全年齢で定額 | ライフイベント（住宅・教育）を表現できない |
| 積立モデル | 余剰→全額特定口座 | NISA年間枠(360万)を無視 |
| 世帯 | 個人のみ | 配偶者の収入・年金・資産を考慮できない |
| ポートフォリオ | 手動設定のみ | 目標に対する最適配分がわからない |

## フェーズ計画

### Phase 1 (v0.9): コアエンジン拡張

SimulationInput を拡張し、runTrial のロジックを強化する。

#### 1-A. 年金統合

```typescript
interface PensionInput {
  /** 厚生年金の見込み月額（ねんきん定期便の値） */
  kosei: number;
  /** 国民年金の見込み月額（満額: 68,000円） */
  kokumin: number;
  /** 受給開始年齢（60-75歳、デフォルト65歳） */
  startAge: number;
}
```

- 繰下げ増額: `(startAge - 65) * 12 * 0.007` (65歳以降、月0.7%増額)
- 繰上げ減額: `(65 - startAge) * 12 * 0.004` (65歳未満、月0.4%減額)
- 年金収入は雑所得として課税（公的年金等控除を適用）

#### 1-B. 退職金

```typescript
interface RetirementBonusInput {
  /** 退職金の見込み額 */
  amount: number;
  /** 勤続年数（退職所得控除の計算用） */
  yearsOfService: number;
}
```

- 退職年に一括で受け取り
- 退職所得控除は既存の税制エンジン (`retirementIncomeDeduction`) を再利用
- 手取り額を特定口座に加算

#### 1-C. 退職後の副収入（サイドFIRE）

```typescript
interface SideIncomeInput {
  /** 退職後の年間副収入（税引前） */
  annualAmount: number;
  /** 副収入が続く年齢の上限 */
  untilAge: number;
}
```

- 事業所得 or 雑所得として課税（簡易計算: 給与所得控除なし、基礎控除のみ）
- 取り崩し必要額を減らす効果

#### 1-D. ライフイベント（一時支出）

```typescript
interface LifeEvent {
  /** イベント名 */
  label: string;
  /** 発生年齢 */
  age: number;
  /** 金額（円） */
  amount: number;
}
```

- 住宅購入、教育費、結婚、車、リフォーム等
- 該当年齢で追加支出として計上
- UI: 年齢と金額のペアを複数入力

#### 1-E. NISA年間積立枠

```typescript
interface NisaConfig {
  /** 年間投資枠（円、デフォルト3,600,000） */
  annualLimit: number;
  /** 生涯投資枠（円、デフォルト18,000,000） */
  lifetimeLimit: number;
}
```

- 退職前の余剰積立を NISA → 特定口座の順に配分
- 生涯枠を超えたら自動的に特定口座へ
- NISA枠の残高を追跡

### Phase 2 (v1.0): 世帯シミュレーション

```typescript
interface HouseholdInput {
  primary: PersonInput;    // 自分
  spouse?: PersonInput;    // 配偶者（任意）
  sharedExpense: number;   // 世帯の年間生活費
  lifeEvents: LifeEvent[]; // 世帯共通のライフイベント
}

interface PersonInput {
  currentAge: number;
  retirementAge: number;
  annualSalary: number;
  accounts: AccountBalance;
  portfolio: PortfolioEntry[];
  pension: PensionInput;
  retirementBonus: RetirementBonusInput;
  sideIncome?: SideIncomeInput;
}
```

- 2人の収入・資産・年金を統合してシミュレーション
- 年齢差を考慮（配偶者の退職時期・年金開始が異なる）
- 世帯の税制最適化（配偶者控除等は将来的に検討）

### Phase 3 (v1.1): ポートフォリオ最適化

```typescript
interface OptimizationInput {
  /** 目標成功率 */
  targetSuccessRate: number;
  /** 投資可能な資産クラス */
  availableAssets: AssetClassId[];
  /** リスク許容度 (0-1) */
  riskTolerance: number;
}
```

- 既存の10資産クラスのリターン・リスクデータを活用
- 効率的フロンティアの計算（平均分散最適化）
- 目標成功率に対する最小リスクポートフォリオを提案
- 処方箋エンジンとの統合（ポートフォリオ変更も処方箋の一軸に）

## アーキテクチャ方針

- **後方互換**: 新フィールドはすべてオプショナル、デフォルト値で既存の動作を維持
- **FormState v3**: スキーマバージョンを上げ、マイグレーション関数で v2 → v3 変換
- **エンジン分離**: simulation/engine.ts の runTrial を拡張。新しい収入・支出ロジックは純粋関数として追加
- **テスト**: 各機能に対してユニットテスト追加。年金計算・退職金課税は税制エンジンのテストとして独立
