"use client";

import { useMemo } from "react";
import type { SimulationResult, TrialResult, TaxBreakdown } from "@/lib/simulation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TaxBreakdownCardProps {
  result: SimulationResult;
  retirementAge: number;
}

function findMedianTrial(trials: TrialResult[]): TrialResult {
  const sorted = [...trials].sort((a, b) => a.finalAssets - b.finalAssets);
  return sorted[Math.floor(sorted.length / 2)];
}

function formatYen(value: number): string {
  return `${value.toLocaleString()}円`;
}

function getInsightText(
  taxBd: TaxBreakdown,
  withdrawal: number,
  isNisaPhase: boolean,
  isTokuteiPhase: boolean,
  isIdecoPhase: boolean,
): string {
  if (withdrawal === 0) {
    return "この年は取り崩しなし（給与所得があります）";
  }
  if (isNisaPhase && taxBd.withdrawalTax === 0) {
    return "NISA口座からの取り崩しにより取り崩し税はゼロです";
  }
  if (isTokuteiPhase && taxBd.withdrawalTax > 0) {
    return "特定口座の含み益に20.315%の譲渡益税がかかっています";
  }
  if (isIdecoPhase && taxBd.withdrawalTax > 0) {
    return "iDeCo一括受取に退職所得控除が適用されています";
  }
  if (taxBd.socialInsurance > taxBd.incomeTax + taxBd.residentTax + taxBd.withdrawalTax) {
    return "税負担の大部分は社会保険料です";
  }
  const effectiveRate = withdrawal > 0 ? taxBd.total / withdrawal : 0;
  if (effectiveRate < 0.1) {
    return "税効率の良い取り崩し戦略です";
  }
  return "";
}

function BreakdownRow({ label, value, sub }: { label: string; value: number; sub?: boolean }) {
  return (
    <div className={`flex justify-between ${sub ? "pl-4 text-muted-foreground" : ""}`}>
      <span className="text-sm">{sub ? `(${label})` : label}</span>
      <span className={`text-sm font-medium tabular-nums ${sub ? "text-muted-foreground" : ""}`}>
        {formatYen(value)}
      </span>
    </div>
  );
}

function SingleBreakdown({
  title,
  yearData,
}: {
  title: string;
  yearData: {
    taxBd: TaxBreakdown;
    withdrawal: number;
    nisa: number;
    tokutei: number;
    ideco: number;
    expense: number;
  };
}) {
  const { taxBd, withdrawal, nisa, tokutei, ideco, expense } = yearData;
  const totalBurden = taxBd.total;
  const effectiveRate = withdrawal > 0
    ? ((totalBurden / withdrawal) * 100).toFixed(1)
    : expense > 0
    ? ((totalBurden / expense) * 100).toFixed(1)
    : "0.0";

  // 口座の取り崩しフェーズを推定
  const isNisaPhase = nisa > 0;
  const isTokuteiPhase = !isNisaPhase && tokutei > 0;
  const isIdecoPhase = !isNisaPhase && !isTokuteiPhase && ideco > 0;

  const insight = getInsightText(taxBd, withdrawal, isNisaPhase, isTokuteiPhase, isIdecoPhase);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {withdrawal > 0 && <BreakdownRow label="取り崩し額" value={withdrawal} />}
        <div className="border-t border-border my-2" />
        <BreakdownRow label="所得税" value={taxBd.incomeTax} />
        <BreakdownRow label="住民税" value={taxBd.residentTax} />
        <BreakdownRow label="社会保険料" value={taxBd.socialInsurance} />
        {taxBd.withdrawalTax > 0 && (
          <BreakdownRow label="取り崩し税" value={taxBd.withdrawalTax} />
        )}
        <div className="border-t border-border my-2" />
        <div className="flex justify-between font-semibold">
          <span className="text-sm">税・社保合計</span>
          <span className="text-sm tabular-nums">{formatYen(totalBurden)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">実効負担率</span>
          <span className="text-sm font-medium tabular-nums text-muted-foreground">{effectiveRate}%</span>
        </div>
        {insight && (
          <p className="text-xs text-muted-foreground mt-2">💡 {insight}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function TaxBreakdownCard({ result, retirementAge }: TaxBreakdownCardProps) {
  const breakdown = useMemo(() => {
    const medianTrial = findMedianTrial(result.trials);
    const years = medianTrial.years;

    // 退職1年目
    const year1 = years.find((y) => y.age === retirementAge);

    // 退職10年目、なければ最終年
    const targetAge10 = retirementAge + 9;
    let year10 = years.find((y) => y.age === targetAge10);
    if (!year10) {
      // endAge - retirementAge < 10 の場合、最終年を使う
      const retiredYears = years.filter((y) => y.age >= retirementAge);
      year10 = retiredYears.length > 1 ? retiredYears[retiredYears.length - 1] : undefined;
    }

    // 枯渇チェック: 資産が0の年は抽出しない
    const isValid = (y: typeof years[number] | undefined) =>
      y && (y.totalAssets > 0 || y.withdrawal > 0);

    return {
      year1: isValid(year1) ? year1! : null,
      year10: isValid(year10) && year10 !== year1 ? year10! : null,
    };
  }, [result, retirementAge]);

  if (!breakdown.year1 && !breakdown.year10) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">税金・社会保険料の内訳</h3>
      <p className="text-sm text-muted-foreground">
        中央値シナリオにおける具体的な税負担です
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {breakdown.year1 && (
          <SingleBreakdown
            title={`退職1年目（${breakdown.year1.age}歳）`}
            yearData={{
              taxBd: breakdown.year1.taxBreakdown,
              withdrawal: breakdown.year1.withdrawal,
              nisa: breakdown.year1.nisa,
              tokutei: breakdown.year1.tokutei,
              ideco: breakdown.year1.ideco,
              expense: breakdown.year1.expense,
            }}
          />
        )}
        {breakdown.year10 && (
          <SingleBreakdown
            title={`退職10年目（${breakdown.year10.age}歳）`}
            yearData={{
              taxBd: breakdown.year10.taxBreakdown,
              withdrawal: breakdown.year10.withdrawal,
              nisa: breakdown.year10.nisa,
              tokutei: breakdown.year10.tokutei,
              ideco: breakdown.year10.ideco,
              expense: breakdown.year10.expense,
            }}
          />
        )}
      </div>
    </div>
  );
}
