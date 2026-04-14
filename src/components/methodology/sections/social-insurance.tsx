import { useMemo } from "react";
import { calcSocialInsurancePremium, calcEmploymentIncome } from "@/lib/tax/engine";
import taxConfig from "@/config/tax-config-2026.json";
import { TwoColumn, ExampleCard, ExampleInput, Step, SourceLink, fmtExact, fmtPct } from "../example-card";

export function SocialInsuranceSection() {
  const cfg = taxConfig;
  const nhi = cfg.socialInsurance.nationalHealthInsurance;

  // 50歳（介護保険あり）の例
  const example50 = useMemo(() => {
    const salary = 5_000_000;
    const empIncome = calcEmploymentIncome(salary);
    const premium = calcSocialInsurancePremium(empIncome, 50);
    return { salary, age: 50, empIncome, premium };
  }, []);

  // 65歳（第1号被保険者）の例
  const example65 = useMemo(() => {
    const income = 2_000_000; // 退職後の年金所得を想定
    const premium = calcSocialInsurancePremium(income, 65);
    return { income, age: 65, premium };
  }, []);

  return (
    <section id="sec-2" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">2. 社会保険料</h3>
      <p className="text-sm text-muted-foreground">
        退職後は国民健康保険(国保) + 国民年金に加入。所得と年齢に応じて保険料が変動します。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">国民健康保険 (国保)</h4>
              <table className="w-full text-sm">
                <caption className="sr-only">国民健康保険料率テーブル</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-left py-1 pr-4">区分</th>
                    <th scope="col" className="text-right py-1 pr-4">所得割</th>
                    <th scope="col" className="text-right py-1 pr-4">均等割</th>
                    <th scope="col" className="text-right py-1">上限</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">医療分</td>
                    <td className="text-right py-1 pr-4 tabular-nums">{fmtPct(nhi.medical.incomeRate)}</td>
                    <td className="text-right py-1 pr-4 tabular-nums">{fmtExact(nhi.medical.perCapita)}</td>
                    <td className="text-right py-1 tabular-nums">{fmtExact(nhi.medical.cap)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">支援分</td>
                    <td className="text-right py-1 pr-4 tabular-nums">{fmtPct(nhi.support.incomeRate)}</td>
                    <td className="text-right py-1 pr-4 tabular-nums">{fmtExact(nhi.support.perCapita)}</td>
                    <td className="text-right py-1 tabular-nums">{fmtExact(nhi.support.cap)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">介護分 ({nhi.longTermCare.minAge}〜{nhi.longTermCare.maxAge}歳)</td>
                    <td className="text-right py-1 pr-4 tabular-nums">{fmtPct(nhi.longTermCare.incomeRate)}</td>
                    <td className="text-right py-1 pr-4 tabular-nums">{fmtExact(nhi.longTermCare.perCapita)}</td>
                    <td className="text-right py-1 tabular-nums">{fmtExact(nhi.longTermCare.cap)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-1">
                基礎控除: {fmtExact(nhi.baseDeduction)} / 合算上限: {fmtExact(nhi.totalCap)}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">65歳以上: 介護保険第1号被保険者</h4>
              <p className="text-sm">年額 {fmtExact(nhi.longTermCareCategory1?.annualPremium ?? 0)}（市区町村基準額）</p>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">国民年金</h4>
              <p className="text-sm">
                月額 {fmtExact(cfg.socialInsurance.nationalPension.monthlyPremium)} ×12 = {fmtExact(cfg.socialInsurance.nationalPension.annualPremium)}/年
              </p>
              <p className="text-xs text-muted-foreground">
                {cfg.socialInsurance.nationalPension.maxAge}歳まで加入義務
              </p>
            </div>
          </div>
        }
        example={
          <div className="space-y-4">
            <ExampleCard>
              <ExampleInput label={`${example50.age}歳・年収`} value={fmtExact(example50.salary)} />
              <Step label="給与所得" value={fmtExact(example50.empIncome)} />
              <Step label="社会保険料合計" value={fmtExact(example50.premium)} />
              <p className="text-xs text-muted-foreground">介護保険(40〜64歳)を含む</p>
            </ExampleCard>
            <ExampleCard>
              <ExampleInput label={`${example65.age}歳・退職後所得`} value={fmtExact(example65.income)} />
              <Step label="社会保険料合計" value={fmtExact(example65.premium)} />
              <p className="text-xs text-muted-foreground">介護保険第1号 + 国民年金なし(60歳以上)</p>
            </ExampleCard>
          </div>
        }
      />
      <SourceLink label="厚生労働省 国民健康保険の保険料" url="https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryouhoken/iryouhoken01/index.html" />
    </section>
  );
}
