import { useMemo } from "react";
import { calcRetirementIncomeDeduction, calcRetirementBonusNet } from "@/lib/tax/engine";
import taxConfig from "@/config/tax-config-2026.json";
import { TwoColumn, ExampleCard, ExampleInput, Step, SourceLink, fmtExact } from "../example-card";

export function RetirementTaxSection() {
  const cfg = taxConfig.incomeTax.retirementIncomeDeduction;

  const example30 = useMemo(() => {
    const amount = 20_000_000;
    const years = 30;
    const deduction = calcRetirementIncomeDeduction(years);
    const result = calcRetirementBonusNet(amount, years);
    return { amount, years, deduction, ...result };
  }, []);

  const example15 = useMemo(() => {
    const amount = 8_000_000;
    const years = 15;
    const deduction = calcRetirementIncomeDeduction(years);
    const result = calcRetirementBonusNet(amount, years);
    return { amount, years, deduction, ...result };
  }, []);

  return (
    <section id="sec-3" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">3. 退職金の税金</h3>
      <p className="text-sm text-muted-foreground">
        退職金は分離課税。退職所得控除を差し引き、さらに1/2にした額に課税されます。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">退職所得控除</h4>
              <table className="w-full text-sm">
                <caption className="sr-only">退職所得控除テーブル</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-left py-1 pr-4">勤続年数</th>
                    <th scope="col" className="text-left py-1">控除額</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">{cfg.yearsThreshold}年以下</td>
                    <td className="py-1">{fmtExact(cfg.belowThresholdPerYear)} × 勤続年数（最低{fmtExact(cfg.minimumDeduction)}）</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">{cfg.yearsThreshold}年超</td>
                    <td className="py-1">{fmtExact(cfg.yearsThreshold * cfg.belowThresholdPerYear)} + {fmtExact(cfg.aboveThresholdPerYear)} ×（勤続年数 − {cfg.yearsThreshold}）</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">退職所得の計算</h4>
              <p className="text-sm">退職所得 =（退職金 − 退職所得控除）× {cfg.taxableRatio}</p>
              <p className="text-xs text-muted-foreground mt-1">分離課税: 所得税(累進) + 住民税10%</p>
            </div>
          </div>
        }
        example={
          <div className="space-y-4">
            <ExampleCard>
              <ExampleInput label="退職金・勤続30年" value={fmtExact(example30.amount)} />
              <Step label="退職所得控除" value={fmtExact(example30.deduction)} />
              <Step label="退職所得" value={fmtExact(Math.floor((example30.amount - example30.deduction) * cfg.taxableRatio))} />
              <Step label="税額" value={fmtExact(example30.tax)} />
              <div className="border-t border-border/50 pt-2 mt-2">
                <Step label="手取り" value={`${fmtExact(example30.net)} ✅`} />
              </div>
            </ExampleCard>
            <ExampleCard>
              <ExampleInput label="退職金・勤続15年" value={fmtExact(example15.amount)} />
              <Step label="退職所得控除" value={fmtExact(example15.deduction)} />
              <Step label="税額" value={fmtExact(example15.tax)} />
              <Step label="手取り" value={fmtExact(example15.net)} />
            </ExampleCard>
          </div>
        }
      />
      <SourceLink label="国税庁 No.1420 退職金を受け取ったとき" url="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1420.htm" />
    </section>
  );
}
