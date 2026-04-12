import { useMemo } from "react";
import {
  calcEmploymentIncomeDeduction,
  calcEmploymentIncome,
  calcBasicDeduction,
  calcSocialInsurancePremium,
  calcTaxableIncome,
  calcIncomeTax,
  calcResidentTax,
  calcAnnualTax,
} from "@/lib/tax/engine";
import taxConfig from "@/config/tax-config-2026.json";
import { TwoColumn, ExampleCard, ExampleInput, Step, SourceLink, fmtExact, fmtYen, fmtPct } from "../example-card";

export function IncomeTaxSection() {
  const cfg = taxConfig;
  const example = useMemo(() => {
    const salary = 5_000_000;
    const age = 35;
    const result = calcAnnualTax(salary, age);
    const empDeduction = calcEmploymentIncomeDeduction(salary);
    const empIncome = calcEmploymentIncome(salary);
    const socialIns = calcSocialInsurancePremium(empIncome, age);
    const basicDed = calcBasicDeduction(empIncome);
    const taxableInc = calcTaxableIncome(empIncome, socialIns);
    const incomeTaxAmount = calcIncomeTax(taxableInc);
    return { salary, empDeduction, empIncome, socialIns, basicDed, taxableInc, incomeTaxAmount, ...result };
  }, []);

  // 境界値の例: 年収850万（給与所得控除上限）
  const edgeExample = useMemo(() => {
    const salary = 8_500_000;
    const result = calcAnnualTax(salary, 45);
    return { salary, ...result };
  }, []);

  return (
    <section id="sec-1" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">1. 給与の手取り計算</h3>
      <p className="text-sm text-muted-foreground">
        給与収入から手取りを算出するまでの流れ: 給与所得控除 → 課税所得 → 所得税(累進課税) → 住民税 → 社会保険料 → 手取り
      </p>

      <TwoColumn
        rule={
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">給与所得控除</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">給与所得控除テーブル</caption>
                  <thead>
                    <tr className="border-b">
                      <th scope="col" className="text-left py-1 pr-4">給与収入</th>
                      <th scope="col" className="text-right py-1">控除額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cfg.incomeTax.employmentIncomeDeduction.thresholds.map((t, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1 pr-4">
                          {t.maxIncome ? `〜${fmtYen(t.maxIncome)}` : `${fmtYen(cfg.incomeTax.employmentIncomeDeduction.thresholds[i - 1]?.maxIncome ?? 0)}超`}
                        </td>
                        <td className="text-right py-1 tabular-nums">
                          {t.deduction !== undefined
                            ? fmtExact(t.deduction)
                            : `${fmtPct(t.rate!)} × 収入 ${t.subtract && t.subtract > 0 ? `+ ${fmtExact(t.subtract)}` : t.subtract && t.subtract < 0 ? `- ${fmtExact(Math.abs(t.subtract))}` : ""}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">所得税率（累進課税）</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">所得税率テーブル</caption>
                  <thead>
                    <tr className="border-b">
                      <th scope="col" className="text-left py-1 pr-4">課税所得</th>
                      <th scope="col" className="text-right py-1 pr-4">税率</th>
                      <th scope="col" className="text-right py-1">控除額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cfg.incomeTax.brackets.map((b, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1 pr-4">
                          {b.to ? `${fmtYen(b.from)}〜${fmtYen(b.to)}` : `${fmtYen(b.from)}超`}
                        </td>
                        <td className="text-right py-1 pr-4 tabular-nums">{fmtPct(b.rate, 0)}</td>
                        <td className="text-right py-1 tabular-nums">{fmtExact(b.deduction)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                復興特別所得税: 所得税額 × {fmtPct(cfg.incomeTax.reconstructionSurtaxRate)}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">住民税</h4>
              <p className="text-sm">所得割 {fmtPct(cfg.residentTax.incomeRate, 0)} + 均等割 {fmtExact(cfg.residentTax.perCapita + cfg.residentTax.forestEnvironmentTax)}/年</p>
            </div>
          </div>
        }
        example={
          <div className="space-y-4">
            <ExampleCard>
              <ExampleInput label="年収" value={fmtExact(example.salary)} />
              <Step label="給与所得控除" value={fmtExact(example.empDeduction)} />
              <Step label="給与所得" value={fmtExact(example.empIncome)} />
              <Step label="社会保険料" value={fmtExact(example.socialInsurance)} />
              <Step label="基礎控除" value={fmtExact(example.basicDed)} />
              <Step label="課税所得" value={fmtExact(example.taxableInc)} />
              <Step label="所得税（復興税込）" value={fmtExact(example.incomeTax)} />
              <Step label="住民税" value={fmtExact(example.residentTax)} />
              <div className="border-t border-border/50 pt-2 mt-2">
                <Step label="手取り" value={`${fmtExact(example.netIncome)} ✅`} />
              </div>
            </ExampleCard>
            <ExampleCard>
              <ExampleInput label="年収（境界値: 給与所得控除上限）" value={fmtExact(edgeExample.salary)} />
              <Step label="手取り" value={fmtExact(edgeExample.netIncome)} />
              <p className="text-xs text-muted-foreground">
                年収850万円超では給与所得控除が{fmtExact(1_950_000)}で頭打ち
              </p>
            </ExampleCard>
          </div>
        }
      />
      <SourceLink label="国税庁 No.1410 給与所得控除" url="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm" />
      <SourceLink label="国税庁 No.2260 所得税の税率" url="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm" />
    </section>
  );
}
