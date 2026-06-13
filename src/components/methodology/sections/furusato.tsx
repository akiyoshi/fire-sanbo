import { useMemo } from "react";
import { calcAnnualTax, calcFurusatoLimit } from "@/lib/tax/engine";
import { TwoColumn, ExampleCard } from "../example-card";

/**
 * §18 ふるさと納税の年間上限
 *
 * v4.6.5 追加。autoplan §7.1。
 */
export function FurusatoSection() {
  const examples = useMemo(() => {
    const cases = [
      { label: "年収500万", salary: 5_000_000 },
      { label: "年収700万", salary: 7_000_000 },
      { label: "年収1000万", salary: 10_000_000 },
      { label: "年収1500万", salary: 15_000_000 },
    ];
    return cases.map((c) => {
      const tax = calcAnnualTax(c.salary, 40);
      const limit = calcFurusatoLimit(tax.taxableIncome, tax.marginalIncomeTaxRate);
      return { ...c, limit };
    });
  }, []);

  return (
    <section id="sec-18" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">18. ふるさと納税の年間上限</h3>
      <p className="text-sm text-muted-foreground">
        自己負担2,000円で済む寄附額の上限は、住民税所得割の約20%＋所得税還付分から決まります（総務省ポータル準拠）。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-2">計算式</h4>
              <p className="text-sm font-mono bg-muted/40 p-2 rounded">
                limit = (taxableIncome × 0.10 × 0.20) / (1 − marginalRate × 1.021 − 0.10) + 2,000
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground mt-2">
                <li>0.10 = 住民税所得割の標準税率</li>
                <li>0.20 = 特例控除部分の上限割合</li>
                <li>1.021 = 復興特別所得税の係数</li>
                <li>2,000 円 = 自己負担分（一律）</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">注意</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>住宅ローン控除・医療費控除・iDeCo拠出があると上限は下がる</li>
                <li>家族構成（配偶者控除・扶養控除）でも変動する</li>
                <li>本ツールは独身・他控除なしの上限値を表示</li>
              </ul>
            </div>
          </div>
        }
        example={
          <ExampleCard>
            <h4 className="text-sm font-medium">年収別の概算上限</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">年収（独身・他控除なし）</th>
                  <th className="text-right py-1">上限</th>
                </tr>
              </thead>
              <tbody>
                {examples.map((e) => (
                  <tr key={e.salary} className="border-b border-muted">
                    <td className="py-1">{e.label}</td>
                    <td className="text-right py-1 font-medium">
                      {Math.round(e.limit / 1000) / 10}万円
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ExampleCard>
        }
      />

      <p className="text-xs text-muted-foreground">
        計算: <code>calcFurusatoLimit</code>（src/lib/tax/engine.ts）。
        結果画面の「ふるさと納税 上限の年次推移」 details で年次表示を確認できます。
      </p>
    </section>
  );
}
