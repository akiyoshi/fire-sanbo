import { TwoColumn, ExampleCard, SourceLink, fmtYen, fmtPct } from "../example-card";

export function AccumulationRebalanceSection() {
  return (
    <section id="sec-14" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">14. 積立リバランス</h3>
      <p className="text-sm text-muted-foreground">
        退職前の余剰積立時、NISA→特定口座の固定順ではなく、
        目標ウェイトに対して最も不足している口座に優先的に配分します。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Stage 2: 積立先の選択ロジック</h4>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li>
                  余剰金を含めた仮の合計額を計算<br />
                  <code className="text-xs bg-muted px-1 rounded">pTotal = 全口座残高 + 余剰金</code>
                </li>
                <li>
                  各口座の目標額と不足額（gap）を算出<br />
                  <code className="text-xs bg-muted px-1 rounded">gap = max(0, pTotal × targetWeight − 現在残高)</code>
                </li>
                <li>不足額（gap）が大きい順にソート</li>
                <li>
                  gap順に余剰金を配分（NISA枠制約を適用）<br />
                  <span className="text-xs">iDeCo・金は積立不可のため対象外</span>
                </li>
                <li>全ての口座がgap=0、またはNISA枠上限に達した残りは特定口座へ</li>
              </ol>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">対象口座</h4>
              <table className="w-full text-sm">
                <caption className="sr-only">積立リバランス対象口座</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-left py-1 pr-4">口座</th>
                    <th scope="col" className="text-left py-1">積立可否</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">NISA</td>
                    <td className="py-1">✓（年間枠・生涯枠制約あり）</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">特定口座</td>
                    <td className="py-1">✓（無制限）</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">現金</td>
                    <td className="py-1">✓（無制限）</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">iDeCo</td>
                    <td className="py-1">✗（口座移管は簡略化のため対象外）</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">金現物</td>
                    <td className="py-1">✗（同上）</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        }
        example={
          <ExampleCard>
            <p className="text-sm font-medium">積立リバランスの例</p>
            <div className="space-y-3 text-sm mt-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">前提: 目標ウェイト NISA {fmtPct(0.5, 0)} / 特定 {fmtPct(0.3, 0)} / 現金 {fmtPct(0.2, 0)}</p>
                <div className="flex justify-between border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">現在の資産</span>
                  <span className="tabular-nums">{fmtYen(8_000_000)}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">余剰金</span>
                  <span className="tabular-nums">{fmtYen(2_000_000)}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">仮合計</span>
                  <span className="tabular-nums">{fmtYen(10_000_000)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">gap計算（不足額）</p>
                <div className="flex justify-between border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">NISA: 目標{fmtYen(5_000_000)} − 現在{fmtYen(3_000_000)}</span>
                  <span className="tabular-nums font-medium">gap {fmtYen(2_000_000)}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">特定: 目標{fmtYen(3_000_000)} − 現在{fmtYen(3_000_000)}</span>
                  <span className="tabular-nums">gap {fmtYen(0)}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">現金: 目標{fmtYen(2_000_000)} − 現在{fmtYen(2_000_000)}</span>
                  <span className="tabular-nums">gap {fmtYen(0)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                → NISA枠が残っていれば{fmtYen(2_000_000)}全額をNISAへ。
                NISAの年間枠上限に達した分は特定口座にフォールバック。
              </p>
            </div>
          </ExampleCard>
        }
      />
      <SourceLink label="simulation/engine.ts — Stage 2: 積立リバランス" url="https://github.com/akiyoshi/fire-sanbo/blob/main/src/lib/simulation/engine.ts" />
    </section>
  );
}
