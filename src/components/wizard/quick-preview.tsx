import { useState, useEffect, useRef, useMemo } from "react";
import type { FormState } from "@/lib/form-state";
import { formToSimulationInput } from "@/lib/form-state";
import { SimulationWorker } from "@/lib/simulation";
import { Card, CardContent } from "@/components/ui/card";

interface QuickPreviewProps {
  form: FormState;
  isValid: boolean;
}

const PREVIEW_SEED = 42;

export function QuickPreview({ form, isValid }: QuickPreviewProps) {
  const [rate, setRate] = useState<number | null>(null);
  const [computing, setComputing] = useState(false);
  const generationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerRef = useRef<SimulationWorker | null>(null);

  // Worker のライフサイクル管理
  useEffect(() => {
    workerRef.current = new SimulationWorker();
    return () => {
      workerRef.current?.dispose();
      workerRef.current = null;
    };
  }, []);

  // form全体をシリアライズして変更検知（全フィールド漏れなし）
  const formFingerprint = useMemo(() => {
    if (!isValid) return null;
    return JSON.stringify(form);
  }, [isValid, form]);

  useEffect(() => {
    if (!formFingerprint) {
      setRate(null);
      return;
    }

    const gen = ++generationRef.current;
    setComputing(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    const currentForm = form;
    timerRef.current = setTimeout(async () => {
      try {
        const input = formToSimulationInput({ ...currentForm, numTrials: 100 });
        input.seed = PREVIEW_SEED;
        const result = workerRef.current
          ? await workerRef.current.run(input)
          : (await import("@/lib/simulation/engine")).runSimulation(input);
        if (gen === generationRef.current) {
          setRate(result.successRate);
        }
      } catch {
        if (gen === generationRef.current) {
          setRate(null);
        }
      }
      if (gen === generationRef.current) {
        setComputing(false);
      }
    }, 800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [formFingerprint, form]);

  if (!isValid || rate === null) return null;

  const pct = Math.round(rate * 100);
  const color =
    pct >= 80
      ? "text-success"
      : pct >= 50
      ? "text-warning"
      : "text-danger";
  const icon = pct >= 80 ? "✅" : pct >= 50 ? "⚠️" : "❌";
  const barColor =
    pct >= 80
      ? "bg-success"
      : pct >= 50
      ? "bg-warning"
      : "bg-danger";

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">概算成功確率</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold tabular-nums ${color}`}>
                {computing ? "..." : <><span aria-hidden="true">{icon} </span>{pct}%</>}
              </span>
              <span className="text-xs text-muted-foreground">
                (100回試行)
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-1.5">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground max-w-[140px]">
            「シミュレーション開始」で詳細な結果・処方箋を表示
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
