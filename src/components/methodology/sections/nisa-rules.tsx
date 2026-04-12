import taxConfig from "@/config/tax-config-2026.json";
import { TwoColumn, ExampleCard, SourceLink, fmtExact, fmtYen } from "../example-card";

export function NisaRulesSection() {
  const cfg = taxConfig.investmentTax;

  return (
    <section id="sec-8" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">8. NISA積立ルール</h3>
      <p className="text-sm text-muted-foreground">
        余剰資金（手取り − 生活費）は NISA → 特定口座 の順に積み立てます。
        NISA枠には年間上限と生涯上限があります。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-4">
            <table className="w-full text-sm">
              <caption className="sr-only">NISA枠の上限</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="text-left py-1 pr-4">枠</th>
                  <th scope="col" className="text-right py-1">上限</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-1 pr-4">年間投資枠</td>
                  <td className="text-right py-1 tabular-nums font-medium">{fmtExact(cfg.nisaAnnualLimit)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1 pr-4">生涯投資枠</td>
                  <td className="text-right py-1 tabular-nums font-medium">{fmtExact(cfg.nisaLifetimeLimit)}</td>
                </tr>
              </tbody>
            </table>

            <div>
              <h4 className="text-sm font-medium mb-2">積立ロジック</h4>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                <li>手取り − 生活費 − ライフイベント費 = 余剰金</li>
                <li>余剰金のうち、年間枠・生涯枠の残りを上限にNISAへ積立</li>
                <li>NISA枠を超えた分は特定口座へ積立</li>
              </ol>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">枠の追跡</h4>
              <p className="text-sm">
                シミュレーション内で年間の積立累計と生涯の積立累計を追跡し、
                どちらかの上限に達した時点で特定口座に切り替えます。
              </p>
            </div>
          </div>
        }
        example={
          <ExampleCard>
            <p className="text-sm font-medium">積立シナリオ例</p>
            <div className="space-y-2 text-sm mt-2">
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">年間余剰</span>
                <span className="tabular-nums">500万円</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">→ NISA積立</span>
                <span className="tabular-nums">{fmtExact(cfg.nisaAnnualLimit)}（年間枠上限）</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">→ 特定口座積立</span>
                <span className="tabular-nums">{fmtExact(5_000_000 - cfg.nisaAnnualLimit)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                生涯枠{fmtYen(cfg.nisaLifetimeLimit)}を使い切ると、
                以降は全額が特定口座に積立されます。
              </p>
            </div>
          </ExampleCard>
        }
      />
      <SourceLink label="金融庁 新しいNISA" url="https://www.fsa.go.jp/policy/nisa2/about/nisa2024/index.html" />
    </section>
  );
}
