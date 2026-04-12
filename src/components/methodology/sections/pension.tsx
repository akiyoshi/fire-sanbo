import { useMemo } from "react";
import { calcPublicPensionDeduction, calcPensionTax } from "@/lib/tax/engine";
import taxConfig from "@/config/tax-config-2026.json";
import { TwoColumn, ExampleCard, ExampleInput, Step, SourceLink, fmtExact, fmtYen, fmtPct } from "../example-card";

export function PensionSection() {
  const cfg = taxConfig;

  // 65歳・年金180万の例
  const example65 = useMemo(() => {
    const pension = 1_800_000;
    const age = 65;
    const deduction = calcPublicPensionDeduction(pension, age);
    const tax = calcPensionTax(pension, age);
    return { pension, age, deduction, ...tax, net: pension - tax.total };
  }, []);

  // 60歳（繰上げ）の例
  const example60 = useMemo(() => {
    const basePension = 1_800_000;
    const earlyMonths = 60; // 5年 = 60ヶ月繰上げ
    const reduction = basePension * 0.004 * earlyMonths;
    const pension = Math.round(basePension - reduction);
    const age = 60;
    const tax = calcPensionTax(pension, age);
    return { basePension, pension, age, reduction, ...tax, net: pension - tax.total };
  }, []);

  return (
    <section id="sec-4" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">4. 公的年金</h3>
      <p className="text-sm text-muted-foreground">
        年金は雑所得として課税。公的年金等控除を適用後、所得税・住民税がかかります。
        繰上げ(60歳〜) / 繰下げ(66歳〜75歳) で受給額が変動します。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">繰上げ・繰下げ調整</h4>
              <table className="w-full text-sm">
                <caption className="sr-only">年金繰上げ・繰下げ調整率</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-left py-1 pr-4">種別</th>
                    <th scope="col" className="text-right py-1 pr-4">1ヶ月あたり</th>
                    <th scope="col" className="text-right py-1">最大</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">繰上げ（60〜64歳）</td>
                    <td className="text-right py-1 pr-4 tabular-nums">−0.4%</td>
                    <td className="text-right py-1 tabular-nums">−24.0%</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">繰下げ（66〜75歳）</td>
                    <td className="text-right py-1 pr-4 tabular-nums">+0.7%</td>
                    <td className="text-right py-1 tabular-nums">+84.0%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">公的年金等控除（65歳以上）</h4>
              <table className="w-full text-sm">
                <caption className="sr-only">公的年金等控除テーブル（65歳以上）</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-left py-1 pr-4">年金収入</th>
                    <th scope="col" className="text-right py-1">控除額</th>
                  </tr>
                </thead>
                <tbody>
                  {cfg.publicPensionDeduction.age65plus.map((b, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1 pr-4">
                        {b.maxIncome ? `〜${fmtYen(b.maxIncome)}` : `${fmtYen(cfg.publicPensionDeduction.age65plus[i - 1]?.maxIncome ?? 0)}超`}
                      </td>
                      <td className="text-right py-1 tabular-nums">
                        {b.deduction !== undefined
                          ? fmtExact(b.deduction)
                          : `${fmtPct(b.rate!)} × 収入 + ${fmtExact(b.base!)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        }
        example={
          <div className="space-y-4">
            <ExampleCard>
              <ExampleInput label="65歳・年金受給額" value={fmtExact(example65.pension)} />
              <Step label="公的年金等控除" value={fmtExact(example65.deduction)} />
              <Step label="雑所得" value={fmtExact(example65.pension - example65.deduction)} />
              <Step label="所得税" value={fmtExact(example65.incomeTax)} />
              <Step label="住民税" value={fmtExact(example65.residentTax)} />
              <div className="border-t border-border/50 pt-2 mt-2">
                <Step label="手取り" value={`${fmtExact(example65.net)} ✅`} />
              </div>
            </ExampleCard>
            <ExampleCard>
              <ExampleInput label="60歳繰上げ（5年 = 60ヶ月）" value={fmtExact(example60.basePension)} />
              <Step label="繰上げ減額" value={`−${fmtExact(example60.reduction)}（−24.0%）`} />
              <Step label="調整後年金" value={fmtExact(example60.pension)} />
              <Step label="税額合計" value={fmtExact(example60.total)} />
              <Step label="手取り" value={fmtExact(example60.net)} />
            </ExampleCard>
          </div>
        }
      />
      <SourceLink label="日本年金機構 繰上げ・繰下げ受給" url="https://www.nenkin.go.jp/service/jukyu/roureinenkin/kuriage-kurisage/index.html" />
      <SourceLink label="国税庁 No.1600 公的年金等の課税関係" url="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1600.htm" />
    </section>
  );
}
