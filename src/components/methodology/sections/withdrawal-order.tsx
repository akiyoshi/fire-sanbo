import { TwoColumn, ExampleCard } from "../example-card";

export function WithdrawalOrderSection() {
  return (
    <section id="sec-7" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">7. 取り崩し順序の根拠</h3>
      <p className="text-sm text-muted-foreground">
        デフォルトの取り崩し順序は「現金 → NISA → 特定 → 金 → iDeCo」。
        税効率と資産成長のバランスに基づいています。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-4">
            <table className="w-full text-sm">
              <caption className="sr-only">取り崩し順序の根拠テーブル</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="text-center py-1 pr-4">順序</th>
                  <th scope="col" className="text-left py-1 pr-4">口座</th>
                  <th scope="col" className="text-left py-1">根拠</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="text-center py-2 pr-4 tabular-nums">1</td>
                  <td className="py-2 pr-4 font-medium">現金</td>
                  <td className="py-2 text-muted-foreground">リターン0%。先に使い切ることで他の資産の運用期間を延ばす</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="text-center py-2 pr-4 tabular-nums">2</td>
                  <td className="py-2 pr-4 font-medium">NISA</td>
                  <td className="py-2 text-muted-foreground">取り崩し非課税。運用益も非課税だが、枠再利用を考慮して早めに取り崩し</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="text-center py-2 pr-4 tabular-nums">3</td>
                  <td className="py-2 pr-4 font-medium">特定口座</td>
                  <td className="py-2 text-muted-foreground">含み益に20.315%課税。運用を続けるより後半の税負担を減らすため中盤で取り崩し</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="text-center py-2 pr-4 tabular-nums">4</td>
                  <td className="py-2 pr-4 font-medium">金現物</td>
                  <td className="py-2 text-muted-foreground">50万控除+1/2課税でやや有利。インフレヘッジ資産として後半まで保有</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="text-center py-2 pr-4 tabular-nums">5</td>
                  <td className="py-2 pr-4 font-medium">iDeCo</td>
                  <td className="py-2 text-muted-foreground">退職所得控除が大きく実質税率が低い。受取制約(60歳〜)もあり最後に温存</td>
                </tr>
              </tbody>
            </table>
          </div>
        }
        example={
          <ExampleCard>
            <p className="text-sm font-medium">なぜこの順序が最適か？</p>
            <div className="space-y-2 text-sm text-muted-foreground mt-2">
              <p>
                <span className="font-medium text-foreground">原則1: 非運用資産を先に消化</span><br />
                現金はリターン0%。保有期間が長いほど機会損失。
              </p>
              <p>
                <span className="font-medium text-foreground">原則2: 非課税口座を先に取り崩し</span><br />
                NISAは取り崩し時の税ゼロ。ただし運用益も非課税のため一概に先とは限らない。
              </p>
              <p>
                <span className="font-medium text-foreground">原則3: 控除の大きい口座を温存</span><br />
                iDeCoの退職所得控除は非常に大きいため、最後に受け取ることで税負担を最小化。
              </p>
              <p className="text-xs">
                ※ 最適な順序は個人の状況により異なります。「取り崩し順序の最適化」機能で
                全順列をシミュレーションできます。
              </p>
            </div>
          </ExampleCard>
        }
      />
    </section>
  );
}
