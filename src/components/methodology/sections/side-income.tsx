import { useMemo } from "react";
import { calcSideIncomeTax } from "@/lib/tax/engine";
import taxConfig from "@/config/tax-config-2026.json";
import { TwoColumn, ExampleCard, ExampleInput, Step, SourceLink, fmtExact } from "../example-card";

export function SideIncomeSection() {
  const cfg = taxConfig;

  const example = useMemo(() => {
    const income = 1_200_000;
    const result = calcSideIncomeTax(income);
    return { income, ...result };
  }, []);

  const exampleHigh = useMemo(() => {
    const income = 3_000_000;
    const result = calcSideIncomeTax(income);
    return { income, ...result };
  }, []);

  return (
    <section id="sec-5" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">5. 副収入の税金</h3>
      <p className="text-sm text-muted-foreground">
        退職後のフリーランス・不労所得等。給与所得控除は適用されず、基礎控除のみで課税所得を計算します。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">計算方法</h4>
              <p className="text-sm">課税所得 = 副収入 − 基礎控除（{fmtExact(cfg.incomeTax.basicDeduction.thresholds[0].deduction)}）</p>
              <p className="text-sm mt-1">税額 = 所得税（累進課税 + 復興特別所得税）+ 住民税</p>
              <p className="text-xs text-muted-foreground mt-2">
                ※ 給与所得控除・社会保険料控除は適用されません（簡易計算）
              </p>
            </div>
          </div>
        }
        example={
          <div className="space-y-4">
            <ExampleCard>
              <ExampleInput label="副収入（年間）" value={fmtExact(example.income)} />
              <Step label="所得税" value={fmtExact(example.incomeTax)} />
              <Step label="住民税" value={fmtExact(example.residentTax)} />
              <div className="border-t border-border/50 pt-2 mt-2">
                <Step label="手取り" value={`${fmtExact(example.net)} ✅`} />
              </div>
            </ExampleCard>
            <ExampleCard>
              <ExampleInput label="副収入（高額例）" value={fmtExact(exampleHigh.income)} />
              <Step label="所得税" value={fmtExact(exampleHigh.incomeTax)} />
              <Step label="住民税" value={fmtExact(exampleHigh.residentTax)} />
              <Step label="手取り" value={fmtExact(exampleHigh.net)} />
            </ExampleCard>
          </div>
        }
      />
      <SourceLink label="国税庁 No.1199 基礎控除" url="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm" />
    </section>
  );
}
