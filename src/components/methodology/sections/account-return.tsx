import { TwoColumn, ExampleCard, SourceLink, fmtPct } from "../example-card";

export function AccountReturnSection() {
  return (
    <section id="sec-13" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">13. 口座別リターンの導出</h3>
      <p className="text-sm text-muted-foreground">
        v4.2以降、各口座（NISA・特定・iDeCo・金）は独自の資産クラス構成を持ち、
        口座ごとに異なる期待リターン・リスクでリターンを生成します。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Stage 1: 口座別リターン生成</h4>
              <p className="text-sm text-muted-foreground mb-3">
                各口座に <code className="text-xs bg-muted px-1 rounded">accountAllocations</code> が設定されている場合、
                口座ごとに独立した対数正規分布リターンを生成します。
              </p>
              <div className="bg-muted rounded-lg p-3 font-mono text-sm space-y-1 border-l-2 border-primary/30">
                <p>μ_i = ln(1 + r_i) − σ_i²/2</p>
                <p>Z_i ~ N(0, 1) &nbsp;<span className="text-muted-foreground">…口座ごとに独立</span></p>
                <p>ret_i = exp(μ_i + σ_i × Z_i) − 1</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">パラメータの導出</h4>
              <p className="text-sm text-muted-foreground">
                口座の資産クラス構成（例: 国内株60%+外国株40%）から
                加重平均で期待リターン <code className="text-xs bg-muted px-1 rounded">r_i</code> と
                合成リスク <code className="text-xs bg-muted px-1 rounded">σ_i</code> を算出します。
                合成リスクは資産クラス間の相関行列を考慮した分散共分散行列から求めます（sec-9参照）。
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">後方互換</h4>
              <p className="text-sm text-muted-foreground">
                <code className="text-xs bg-muted px-1 rounded">accountAllocations</code> が未設定の場合、
                全口座にポートフォリオ全体の期待リターン・リスクを適用します（v4.0と同一動作）。
              </p>
            </div>
          </div>
        }
        example={
          <ExampleCard>
            <p className="text-sm font-medium">口座別リターンの例</p>
            <div className="space-y-3 text-sm mt-2">
              <table className="w-full text-sm">
                <caption className="sr-only">口座別リターンの例</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-left py-1 pr-4">口座</th>
                    <th scope="col" className="text-right py-1 pr-4">期待リターン</th>
                    <th scope="col" className="text-right py-1">リスク(σ)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">NISA</td>
                    <td className="text-right py-1 pr-4 tabular-nums">{fmtPct(0.06)}</td>
                    <td className="text-right py-1 tabular-nums">{fmtPct(0.18)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">特定口座</td>
                    <td className="text-right py-1 pr-4 tabular-nums">{fmtPct(0.05)}</td>
                    <td className="text-right py-1 tabular-nums">{fmtPct(0.15)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">iDeCo</td>
                    <td className="text-right py-1 pr-4 tabular-nums">{fmtPct(0.04)}</td>
                    <td className="text-right py-1 tabular-nums">{fmtPct(0.12)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-4">金現物</td>
                    <td className="text-right py-1 pr-4 tabular-nums">{fmtPct(0.02)}</td>
                    <td className="text-right py-1 tabular-nums">{fmtPct(0.16)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">
                同じ年でもNISAが+12%、iDeCoが-3%のように口座ごとに異なるリターンが適用されます。
                現金口座はリターン0%で元本を維持します。
              </p>
            </div>
          </ExampleCard>
        }
      />
      <SourceLink label="simulation/engine.ts — Stage 1: 口座別リターン" url="https://github.com/akiyoshi/fire-sanbo/blob/main/src/lib/simulation/engine.ts" />
    </section>
  );
}
