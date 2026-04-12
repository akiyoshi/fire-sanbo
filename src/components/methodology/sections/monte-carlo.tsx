import { SourceLink } from "../example-card";

export function MonteCarloSection() {
  return (
    <section id="sec-11" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">11. モンテカルロ法</h3>
      <p className="text-sm text-muted-foreground">
        将来のリターンは不確実なため、乱数で複数回シミュレーションし、
        成功確率とパーセンタイル帯を求めます。
      </p>

      <div className="space-y-4">
        <div className="bg-muted rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium">手法</h4>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              <span className="font-medium">試行回数</span>: デフォルト1,000回（設定で変更可）
            </li>
            <li>
              <span className="font-medium">乱数生成器</span>: Mulberry32（シード付き疑似乱数）
              <p className="text-xs text-muted-foreground ml-5">同じシード → 同じ結果。再現性を保証</p>
            </li>
            <li>
              <span className="font-medium">正規分布</span>: Box-Muller法で一様乱数から標準正規分布を生成
            </li>
            <li>
              <span className="font-medium">リターン</span>: 対数正規分布（セクション9参照）
            </li>
          </ol>
        </div>

        <div className="bg-muted rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium">結果の集計</h4>
          <table className="w-full text-sm">
            <caption className="sr-only">モンテカルロ法の結果指標</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="text-left py-1 pr-4">指標</th>
                <th scope="col" className="text-left py-1">意味</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1 pr-4 font-medium">成功率</td>
                <td className="py-1">資産が枯渇しなかった試行の割合</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1 pr-4 font-medium">p5 / p95</td>
                <td className="py-1">90%信頼区間（チャートの薄い帯）</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1 pr-4 font-medium">p25 / p75</td>
                <td className="py-1">50%信頼区間（チャートの濃い帯）</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1 pr-4 font-medium">p50</td>
                <td className="py-1">中央値（チャートの実線）</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-muted rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium">Web Worker</h4>
          <p className="text-sm">
            1,000回 × 数十年のシミュレーションをメインスレッドでは行わず、
            Web Workerでオフスレッド実行しています。UIがフリーズしません。
          </p>
          <p className="text-xs text-muted-foreground">
            Worker起動失敗時はメインスレッドにフォールバック
          </p>
        </div>
      </div>

      <SourceLink label="Wikipedia: Monte Carlo method" url="https://en.wikipedia.org/wiki/Monte_Carlo_method" />
    </section>
  );
}
