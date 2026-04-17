import { useState, useCallback, useRef, useEffect } from "react";
import type { SimulationWorker } from "@/lib/simulation";
import type { SimulationInput } from "@/lib/simulation";
import type { PrescriptionResult, Prescription, Difficulty, FrontierPoint } from "@/lib/prescription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Wallet, CalendarClock, Banknote, PieChart } from "lucide-react";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "やさしい",
  moderate: "ふつう",
  hard: "むずかしい",
};

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: "bg-success/15 text-success",
  moderate: "bg-warning/15 text-warning",
  hard: "bg-danger/15 text-danger",
};

const AXIS_ICON: Record<string, React.ReactNode> = {
  expense: <Wallet className="h-5 w-5 text-muted-foreground" />,
  retirement: <CalendarClock className="h-5 w-5 text-muted-foreground" />,
  income: <Banknote className="h-5 w-5 text-muted-foreground" />,
  allocation: <PieChart className="h-5 w-5 text-muted-foreground" />,
};

function PrescriptionItem({
  rx,
  isTopImpact,
  onApplyAllocation,
}: {
  rx: Prescription;
  isTopImpact: boolean;
  onApplyAllocation?: (weights: Record<string, number>) => void;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border bg-card ${isTopImpact ? "border-primary border-2" : ""}`}>
      <span className="shrink-0 mt-0.5" aria-hidden="true">
        {AXIS_ICON[rx.axis]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{rx.label}</p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLOR[rx.difficulty]}`}
          >
            {DIFFICULTY_LABEL[rx.difficulty]}
          </span>
          <span className="text-xs text-muted-foreground">
            {rx.delta}
          </span>
        </div>
        {rx.axis === "allocation" && rx.recommendedAllocation && onApplyAllocation && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => onApplyAllocation(rx.recommendedAllocation!)}
          >
            この配分を適用
          </Button>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-lg font-bold">{Math.round(rx.resultRate * 100)}%</p>
        <p className="text-xs text-muted-foreground">達成率</p>
      </div>
    </div>
  );
}

interface PrescriptionCardProps {
  worker: SimulationWorker | null;
  input: SimulationInput;
  currentRate: number;
  frontier?: FrontierPoint[];
  onResult?: (result: PrescriptionResult | null) => void;
  onApplyAllocation?: (weights: Record<string, number>) => void;
}

export function PrescriptionCard({ worker, input, currentRate, frontier, onResult, onApplyAllocation }: PrescriptionCardProps) {
  const [targetRate, setTargetRate] = useState(90);
  const [result, setResult] = useState<PrescriptionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const targetRateRef = useRef(90);
  const generationRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seedRef = useRef(Math.floor(Math.random() * 2 ** 32));

  // input/targetRateが変わったら再計算
  const recalculate = useCallback(
    (newTargetRate: number) => {
      setIsLoading(true);
      const gen = ++generationRef.current;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const prescResult = worker
            ? await worker.prescribe(input, newTargetRate / 100, seedRef.current, frontier)
            : await import("@/lib/prescription").then((m) =>
                m.generatePrescriptions(input, newTargetRate / 100, seedRef.current, frontier),
              );
          if (gen !== generationRef.current) return;
          setResult(prescResult);
          onResult?.(prescResult);
        } catch {
          if (gen !== generationRef.current) return;
        }
        setIsLoading(false);
      }, 500);
    },
    [worker, input, frontier, onResult],
  );

  // input や callback が変わったときだけ、現在の目標成功率で再計算する
  useEffect(() => {
    recalculate(targetRateRef.current);
  }, [recalculate]);

  // cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleTargetChange = useCallback(
    (v: number | readonly number[]) => {
      const newRate = Array.isArray(v) ? v[0] : v;
      targetRateRef.current = newRate;
      setTargetRate(newRate);
      recalculate(newRate);
    },
    [recalculate],
  );

  const currentPct = Math.round(currentRate * 100);
  const alreadyAchieved = currentPct >= targetRate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>処方箋</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 目標成功率スライダー */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="target-rate-slider">目標成功率</Label>
            <span className="text-sm font-medium">{targetRate}%</span>
          </div>
          <Slider
            id="target-rate-slider"
            value={[targetRate]}
            onValueChange={handleTargetChange}
            min={80}
            max={99}
            step={1}
            aria-label="目標成功率"
          />
        </div>

        {/* ローディング: スケルトンUI */}
        {isLoading && (
          <div className="space-y-3" aria-label="処方箋を計算中">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card animate-pulse">
                <div className="shrink-0 mt-0.5 h-5 w-5 rounded bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
                <div className="text-right space-y-1">
                  <div className="h-6 w-10 rounded bg-muted" />
                  <div className="h-3 w-8 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 結果 */}
        {!isLoading && alreadyAchieved && (
          <div className="text-center py-4 rounded-lg bg-green-50 dark:bg-green-950">
            <p className="text-green-700 dark:text-green-300 font-medium">
              現在の成功率 {currentPct}% は目標 {targetRate}% を達成しています
            </p>
          </div>
        )}

        {!isLoading && !alreadyAchieved && result && (
          <div className="space-y-3">
            {result.prescriptions.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  目標 {targetRate}% を達成するための改善案:
                </p>
                {(() => {
                  const maxRate = Math.max(...result.prescriptions.map((p) => p.resultRate));
                  return result.prescriptions.map((rx) => (
                    <PrescriptionItem
                      key={rx.axis}
                      rx={rx}
                      isTopImpact={rx.resultRate === maxRate}
                      onApplyAllocation={onApplyAllocation}
                    />
                  ));
                })()}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  探索範囲内では目標 {targetRate}% に到達する改善案が見つかりませんでした
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
