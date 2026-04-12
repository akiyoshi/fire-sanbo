import { useMemo } from "react";
import type { SimulationResult } from "@/lib/simulation";
import { findP5Trial, diagnoseFailure } from "@/lib/simulation/diagnosis";
import type { Diagnosis } from "@/lib/simulation/diagnosis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WorstCaseCardProps {
  result: SimulationResult;
  retirementAge: number;
}

const CAUSE_ICON: Record<string, string> = {
  crash: "📉",
  underfunded: "💰",
  life_event: "🎯",
  longevity: "⏳",
  none: "✅",
};

function formatManYen(n: number): string {
  const man = Math.round(n / 10000);
  if (Math.abs(man) >= 10000) {
    const oku = man / 10000;
    return oku % 1 === 0 ? `${oku}億` : `${oku.toFixed(1)}億`;
  }
  return `${man.toLocaleString()}万`;
}

function formatReturn(r: number): string {
  const pct = (r * 100).toFixed(1);
  return r >= 0 ? `+${pct}%` : `${pct}%`;
}

function DiagnosisSummary({ diagnosis }: { diagnosis: Diagnosis }) {
  const icon = CAUSE_ICON[diagnosis.cause] ?? "❓";
  const bgColor = diagnosis.cause === "none"
    ? "bg-success/10 border-success/30"
    : "bg-danger/10 border-danger/30";

  return (
    <div className={`rounded-lg border p-3 ${bgColor}`}>
      <p className="text-sm font-medium">
        {icon} {diagnosis.causeLabel}
      </p>
      <p className="text-sm text-muted-foreground mt-1">{diagnosis.summary}</p>
    </div>
  );
}

function ComparisonTable({
  diagnosis,
  medianAssets,
  ages,
}: {
  diagnosis: Diagnosis;
  medianAssets: number[];
  ages: number[];
}) {
  const years = diagnosis.worstTrial.years;
  const retAge = diagnosis.retirementAge;

  // 表示する年を間引く: 退職前後5年 + 転換点前後 + 枯渇年 + 5年刻み
  const importantAges = useMemo(() => {
    const set = new Set<number>();
    // 退職年とその前後
    set.add(retAge - 1);
    set.add(retAge);
    set.add(retAge + 1);
    // 転換点前後
    if (diagnosis.turningPoint) {
      const tp = diagnosis.turningPoint.age;
      set.add(tp - 1);
      set.add(tp);
      set.add(tp + 1);
    }
    // 枯渇年
    if (diagnosis.worstTrial.depletionAge) {
      set.add(diagnosis.worstTrial.depletionAge);
    }
    // 5年刻み
    for (const y of years) {
      if (y.age % 5 === 0) set.add(y.age);
    }
    // 最初と最後
    if (years.length > 0) {
      set.add(years[0].age);
      set.add(years[years.length - 1].age);
    }
    return [...set].filter((a) => years.some((y) => y.age === a)).sort((a, b) => a - b);
  }, [years, retAge, diagnosis]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">最悪ケースと中央値の対比テーブル</caption>
        <thead>
          <tr className="border-b text-xs">
            <th scope="col" className="text-left py-1.5 pr-2">年齢</th>
            <th scope="col" className="text-right py-1.5 pr-2">最悪(p5)</th>
            <th scope="col" className="text-right py-1.5 pr-2">中央値</th>
            <th scope="col" className="text-right py-1.5 pr-2">差額</th>
            <th scope="col" className="text-right py-1.5 pr-2">リターン</th>
            <th scope="col" className="text-right py-1.5 pr-2">収入</th>
            <th scope="col" className="text-right py-1.5 pr-2">支出</th>
            <th scope="col" className="text-right py-1.5">取崩</th>
          </tr>
        </thead>
        <tbody>
          {importantAges.map((age) => {
            const y = years.find((yr) => yr.age === age);
            if (!y) return null;
            const ageIdx = ages.indexOf(age);
            const med = ageIdx >= 0 ? medianAssets[ageIdx] : 0;
            const diff = y.totalAssets - med;

            const isCrashYear = y.portfolioReturn <= -0.20;
            const isDepletionYear = age === diagnosis.worstTrial.depletionAge;
            const isTurningPoint = age === diagnosis.turningPoint?.age;

            let rowClass = "border-b border-border/30";
            if (isDepletionYear) rowClass += " bg-danger/10 font-bold";
            else if (isCrashYear) rowClass += " bg-danger/5";
            else if (isTurningPoint) rowClass += " bg-warning/10";

            return (
              <tr key={age} className={rowClass}>
                <td className="py-1.5 pr-2 tabular-nums">
                  {age}歳
                  {age === retAge && <span className="text-xs text-muted-foreground ml-1">(退職)</span>}
                  {isDepletionYear && <span className="text-xs text-danger ml-1">🔴</span>}
                </td>
                <td className={`text-right py-1.5 pr-2 tabular-nums ${y.totalAssets <= 0 ? "text-danger font-bold" : ""}`}>
                  {formatManYen(y.totalAssets)}
                </td>
                <td className="text-right py-1.5 pr-2 tabular-nums text-muted-foreground">
                  {formatManYen(med)}
                </td>
                <td className={`text-right py-1.5 pr-2 tabular-nums ${diff < 0 ? "text-danger" : "text-success"}`}>
                  {diff >= 0 ? "+" : ""}{formatManYen(diff)}
                </td>
                <td className={`text-right py-1.5 pr-2 tabular-nums ${isCrashYear ? "text-danger font-bold" : y.portfolioReturn < 0 ? "text-danger" : ""}`}>
                  {formatReturn(y.portfolioReturn)}
                  {isCrashYear && <span className="ml-0.5">🔴</span>}
                </td>
                <td className="text-right py-1.5 pr-2 tabular-nums text-muted-foreground">
                  {formatManYen(y.income)}
                </td>
                <td className="text-right py-1.5 pr-2 tabular-nums text-muted-foreground">
                  {formatManYen(y.expense)}
                </td>
                <td className="text-right py-1.5 tabular-nums text-muted-foreground">
                  {formatManYen(y.withdrawal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function WorstCaseCard({ result, retirementAge }: WorstCaseCardProps) {
  const diagnosis = useMemo(() => {
    const p5Trial = findP5Trial(result);
    return diagnoseFailure(p5Trial, retirementAge, result.percentiles.p50);
  }, [result, retirementAge]);

  // 全試行が成功の場合は表示しない
  if (result.successRate >= 1.0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>最悪ケース診断書（p5）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DiagnosisSummary diagnosis={diagnosis} />
        <ComparisonTable
          diagnosis={diagnosis}
          medianAssets={result.percentiles.p50}
          ages={result.ages}
        />
        <p className="text-xs text-muted-foreground">
          p5 = 下位5%シナリオ。20回に1回程度起こりうる悪いケースです。
        </p>
      </CardContent>
    </Card>
  );
}
