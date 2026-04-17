/** 処方箋の軸 */
export type PrescriptionAxis = "expense" | "retirement" | "income" | "allocation";

/** 難易度 */
export type Difficulty = "easy" | "moderate" | "hard";

/** 1つの処方箋 */
export interface Prescription {
  axis: PrescriptionAxis;
  label: string;
  currentValue: number;
  targetValue: number;
  delta: string;
  resultRate: number;
  difficulty: Difficulty;
  /** allocation軸のみ: 推奨アセットアロケーション */
  recommendedAllocation?: Record<string, number>;
}

/** 処方箋エンジンの出力 */
export interface PrescriptionResult {
  targetRate: number;
  currentRate: number;
  prescriptions: Prescription[];
  /** 現在の成功率が既に目標以上 */
  alreadyAchieved: boolean;
}
