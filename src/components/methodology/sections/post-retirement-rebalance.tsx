import { TwoColumn, ExampleCard, SourceLink, fmtYen, fmtPct, fmtExact } from "../example-card";

export function PostRetirementRebalanceSection() {
  return (
    <section id="sec-15" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">15. 退職後リバランス</h3>
      <p className="text-sm text-muted-foreground">
        退職後、口座間の比率が目標ウェイトから一定以上乖離した場合に
        売買によるリバランスを実行します。売却時は口座の税制に基づいて課税されます。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Stage 3: 退職後リバランスの判定と実行</h4>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li>
                  各口座の現在ウェイトを計算<br />
                  <code className="text-xs bg-muted px-1 rounded">currentW_i = 口座残高_i / 総資産</code>
                </li>
                <li>
                  目標ウェイトとの乖離が閾値（デフォルト{fmtPct(0.05, 0)}）を超える口座があるか判定
                </li>
                <li>乖離がある場合、各口座を目標額に向けて売買を実行</li>
                <li>売却時の課税を計算（口座種別ごと）</li>
                <li>課税による目減り分を全口座に按分で調整</li>
              </ol>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">口座別の課税ルール</h4>
              <table className="w-full text-sm">
                <caption className="sr-only">リバランス時の口座別課税</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-left py-1 pr-4">口座</th>
                    <th scope="col" className="text-left py-1">リバランス課税</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4 font-medium">特定口座</td>
                    <td className="py-1">売却益 × 含み益率 × {fmtPct(0.20315)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4 font-medium">金現物</td>
                    <td className="py-1">max(0, 売却益 × 含み益率 − 50万) ÷ 2 → 絟進課税（他の総合課税所得と合算）</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4 font-medium">NISA</td>
                    <td className="py-1">非課税（売買とも）</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4 font-medium">iDeCo</td>
                    <td className="py-1">口座内リバランスは非課税</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4 font-medium">現金</td>
                    <td className="py-1">課税なし</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">iDeCo年齢制約</h4>
              <p className="text-sm text-muted-foreground">
                60歳未満の場合、iDeCoは確定拠出年金法により取り崩し不可。
                リバランス時もiDeCo口座はロックされ、目標ウェイトへの調整対象外となります。
              </p>
            </div>
          </div>
        }
        example={
          <ExampleCard>
            <p className="text-sm font-medium">退職後リバランスの例</p>
            <div className="space-y-3 text-sm mt-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  前提: 総資産{fmtYen(20_000_000)}、閾値{fmtPct(0.05, 0)}、含み益率50%
                </p>
              </div>

              <table className="w-full text-xs">
                <caption className="sr-only">リバランス前後の口座比率</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-left py-1 pr-2">口座</th>
                    <th scope="col" className="text-right py-1 pr-2">現在</th>
                    <th scope="col" className="text-right py-1 pr-2">目標</th>
                    <th scope="col" className="text-right py-1">乖離</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-2">NISA</td>
                    <td className="text-right py-1 pr-2 tabular-nums">{fmtPct(0.40)}</td>
                    <td className="text-right py-1 pr-2 tabular-nums">{fmtPct(0.30)}</td>
                    <td className="text-right py-1 tabular-nums text-danger">+{fmtPct(0.10)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-2">特定</td>
                    <td className="text-right py-1 pr-2 tabular-nums">{fmtPct(0.15)}</td>
                    <td className="text-right py-1 pr-2 tabular-nums">{fmtPct(0.25)}</td>
                    <td className="text-right py-1 tabular-nums text-warning">-{fmtPct(0.10)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-2">iDeCo</td>
                    <td className="text-right py-1 pr-2 tabular-nums">{fmtPct(0.20)}</td>
                    <td className="text-right py-1 pr-2 tabular-nums">{fmtPct(0.20)}</td>
                    <td className="text-right py-1 tabular-nums">{fmtPct(0)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-2">金</td>
                    <td className="text-right py-1 pr-2 tabular-nums">{fmtPct(0.15)}</td>
                    <td className="text-right py-1 pr-2 tabular-nums">{fmtPct(0.15)}</td>
                    <td className="text-right py-1 tabular-nums">{fmtPct(0)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-2">現金</td>
                    <td className="text-right py-1 pr-2 tabular-nums">{fmtPct(0.10)}</td>
                    <td className="text-right py-1 pr-2 tabular-nums">{fmtPct(0.10)}</td>
                    <td className="text-right py-1 tabular-nums">{fmtPct(0)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="space-y-1">
                <p className="text-xs font-medium">リバランス実行</p>
                <div className="flex justify-between border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">NISA売却</span>
                  <span className="tabular-nums">{fmtYen(2_000_000)}<span className="text-muted-foreground">（非課税）</span></span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">特定口座購入</span>
                  <span className="tabular-nums">{fmtYen(2_000_000)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium">もし特定口座を売却する場合</p>
                <div className="flex justify-between border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">売却額</span>
                  <span className="tabular-nums">{fmtYen(2_000_000)}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">課税対象（含み益50%）</span>
                  <span className="tabular-nums">{fmtYen(1_000_000)}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-1">
                  <span className="text-muted-foreground">税額（20.315%）</span>
                  <span className="tabular-nums">{fmtExact(203_150)}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                税コストが発生するため、リバランスの頻度は閾値で制御されます。
                デフォルト5%は年1〜2回のリバランスに相当する水準です。
              </p>
            </div>
          </ExampleCard>
        }
      />
      <SourceLink label="simulation/engine.ts — Stage 3: 退職後リバランス" url="https://github.com/akiyoshi/fire-sanbo/blob/main/src/lib/simulation/engine.ts" />
    </section>
  );
}
