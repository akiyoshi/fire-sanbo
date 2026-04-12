import { SourceLink } from "../example-card";

export function PortfolioReturnSection() {
  return (
    <section id="sec-9" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">9. ポートフォリオリターン</h3>
      <p className="text-sm text-muted-foreground">
        毎年のリターンは対数正規分布に従う確率変数として生成されます。
        期待リターンとリスク（標準偏差）からポートフォリオの年間収益率を計算します。
      </p>

      <div className="space-y-4">
        <div className="bg-muted rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium">対数正規分布のリターン生成</h4>
          <div className="font-mono text-sm space-y-1">
            <p>μ = ln(1 + 期待リターン) − σ²/2 &nbsp;&nbsp;<span className="text-muted-foreground">…ボラティリティドラグ補正</span></p>
            <p>Z ~ N(0, 1) &nbsp;&nbsp;<span className="text-muted-foreground">…Box-Muller法で生成</span></p>
            <p>r = exp(μ + σ × Z) − 1 &nbsp;&nbsp;<span className="text-muted-foreground">…年間リターン</span></p>
          </div>
          <p className="text-xs text-muted-foreground">
            σ²/2 を引くのは「ボラティリティドラグ」の補正。対数正規分布の期待値が
            E[1+r] = 1 + 期待リターン となるよう調整しています。
          </p>
        </div>

        <div className="bg-muted rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium">実質リターン</h4>
          <div className="font-mono text-sm">
            <p>実質リターン = 名目リターン − インフレ率</p>
          </div>
          <p className="text-xs text-muted-foreground">
            支出はインフレ率で毎年増加する一方、資産リターンは名目ベース。
            シミュレーション内では実質リターンを使用して整合性を保っています。
          </p>
        </div>

        <div className="bg-muted rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium">ポートフォリオの合成リスク</h4>
          <div className="font-mono text-sm">
            <p>σ_p = √(Σ_i Σ_j w_i × w_j × σ_i × σ_j × ρ_ij)</p>
          </div>
          <p className="text-xs text-muted-foreground">
            w: 各資産のウェイト、σ: 標準偏差、ρ: 相関係数。
            分散共分散行列によりポートフォリオの分散効果を反映しています。
          </p>
        </div>
      </div>

      <SourceLink label="Wikipedia: Geometric Brownian motion" url="https://en.wikipedia.org/wiki/Geometric_Brownian_motion" />
    </section>
  );
}
