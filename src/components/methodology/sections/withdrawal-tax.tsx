import { useMemo } from "react";
import { calcWithdrawalTax } from "@/lib/tax/accounts";
import taxConfig from "@/config/tax-config-2026.json";
import { TwoColumn, ExampleCard, ExampleInput, SourceLink, fmtExact, fmtPct } from "../example-card";

export function WithdrawalTaxSection() {
  const cfg = taxConfig;

  // 各口座から100万円取り崩した場合の比較
  const amount = 1_000_000;
  const comparisons = useMemo(() => {
    const accounts = [
      { category: "cash" as const, label: "現金", options: {} },
      { category: "nisa" as const, label: "NISA", options: {} },
      { category: "tokutei" as const, label: "特定口座", options: { gainRatio: 0.5 } },
      { category: "gold_physical" as const, label: "金現物", options: { goldGainRatio: 0.5 } },
      { category: "ideco" as const, label: "iDeCo", options: { yearsOfService: 20 } },
    ];
    return accounts.map((a) => {
      const result = calcWithdrawalTax(a.category, amount, a.options);
      return { ...a, ...result };
    });
  }, []);

  return (
    <section id="sec-6" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">6. 口座の取り崩し税</h3>
      <p className="text-sm text-muted-foreground">
        口座の種類によって取り崩し時の税率が異なります。以下は各口座から{fmtExact(amount)}を取り崩した場合の比較です。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-4">
            <table className="w-full text-sm">
              <caption className="sr-only">口座別取り崩し税率テーブル</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="text-left py-1 pr-4">口座</th>
                  <th scope="col" className="text-left py-1 pr-4">課税方式</th>
                  <th scope="col" className="text-right py-1">実質税率</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-1 pr-4">現金</td>
                  <td className="py-1 pr-4">非課税</td>
                  <td className="text-right py-1 tabular-nums">0%</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1 pr-4">NISA</td>
                  <td className="py-1 pr-4">非課税</td>
                  <td className="text-right py-1 tabular-nums">0%</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1 pr-4">特定口座</td>
                  <td className="py-1 pr-4">申告分離課税（含み益部分）</td>
                  <td className="text-right py-1 tabular-nums">{fmtPct(cfg.investmentTax.tokuteiRate)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1 pr-4">金現物</td>
                  <td className="py-1 pr-4">総合課税（50万控除 + 1/2課税）</td>
                  <td className="text-right py-1 tabular-nums text-muted-foreground">所得による</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1 pr-4">iDeCo</td>
                  <td className="py-1 pr-4">退職所得控除 + 1/2課税</td>
                  <td className="text-right py-1 tabular-nums text-muted-foreground">勤続年数による</td>
                </tr>
              </tbody>
            </table>
          </div>
        }
        example={
          <ExampleCard>
            <ExampleInput label="取り崩し額" value={fmtExact(amount)} />
            <p className="text-xs text-muted-foreground mb-2">含み益率50%・勤続20年の場合</p>
            {comparisons.map((c) => (
              <div key={c.category} className="flex justify-between text-sm py-0.5 border-b border-border/30 last:border-0">
                <span>{c.label}</span>
                <span className="tabular-nums">
                  税 {fmtExact(c.tax)} → 手取り <span className="font-medium">{fmtExact(c.net)}</span>
                </span>
              </div>
            ))}
          </ExampleCard>
        }
      />
      <SourceLink label="国税庁 No.1463 株式等を譲渡したとき" url="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1463.htm" />
      <SourceLink label="国税庁 No.3161 金地金の譲渡による所得" url="https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3161.htm" />
    </section>
  );
}
