import rawData from "@/config/asset-class-data.json";
import { fmtPct } from "../example-card";
import { SourceLink } from "../example-card";

const assetClasses = rawData.assetClasses as Record<string, { label: string; expectedReturn: number; risk: number }>;
const correlationOrder = rawData.correlationMatrix.order as string[];
const correlationMatrix = rawData.correlationMatrix.matrix as number[][];

export function AssetClassesSection() {
  const entries = correlationOrder.map((id) => ({
    id,
    ...assetClasses[id],
  }));

  return (
    <section id="sec-10" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">10. 資産クラスのパラメータ</h3>
      <p className="text-sm text-muted-foreground">
        各資産クラスの期待リターンとリスク（年率標準偏差）。{rawData.source}
      </p>

      <div className="space-y-4">
        <table className="w-full text-sm">
          <caption className="sr-only">資産クラスの期待リターンとリスク</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="text-left py-1 pr-4">資産クラス</th>
              <th scope="col" className="text-right py-1 pr-4">期待リターン</th>
              <th scope="col" className="text-right py-1">リスク(σ)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-border/50">
                <td className="py-1 pr-4">{e.label}</td>
                <td className="text-right py-1 pr-4 tabular-nums">{fmtPct(e.expectedReturn)}</td>
                <td className="text-right py-1 tabular-nums">{fmtPct(e.risk)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div>
          <h4 className="text-sm font-medium mb-2">相関行列</h4>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <caption className="sr-only">資産クラス間の相関係数行列</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="py-1 pr-2"></th>
                  {entries.map((e) => (
                    <th key={e.id} scope="col" className="py-1 px-1 text-center whitespace-nowrap">
                      {e.label.replace("国内", "国").replace("先進国", "先").replace("新興国", "新").replace("現金・預金", "現金")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((row, i) => (
                  <tr key={row.id} className="border-b border-border/30">
                    <th scope="row" className="py-1 pr-2 text-left whitespace-nowrap font-normal">
                      {row.label.replace("国内", "国").replace("先進国", "先").replace("新興国", "新").replace("現金・預金", "現金")}
                    </th>
                    {correlationMatrix[i].map((val, j) => (
                      <td
                        key={j}
                        className={`py-1 px-1 text-center tabular-nums ${
                          i === j ? "font-medium" : val > 0.5 ? "text-danger" : val < 0 ? "text-chart-2" : ""
                        }`}
                      >
                        {val.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            データ期間: {rawData.period}。最終更新: {rawData.lastUpdated}
          </p>
        </div>
      </div>

      <SourceLink label="GPIF 基本ポートフォリオの考え方" url="https://www.gpif.go.jp/gpif/portfolio.html" />
    </section>
  );
}
