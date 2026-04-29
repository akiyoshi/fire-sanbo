import { TwoColumn, ExampleCard } from "../example-card";

/**
 * §17 SWR (Safe Withdrawal Rate) と日本税制
 *
 * v4.6.5 追加。autoplan §7.1。
 */
export function SwrSection() {
  return (
    <section id="sec-17" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">17. SWR（Safe Withdrawal Rate）と日本税制</h3>
      <p className="text-sm text-muted-foreground">
        Bengen の 4% ルール（米国・1994）は、退職時点の資産の 4% を毎年取り崩しても
        30年間枯渇しないという経験則です。日本では税制が異なるため、実態は 3% 前後に下がる傾向があります。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-2">アルゴリズム</h4>
              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                <li>シミュレーション入力の年間支出を二分探索</li>
                <li>各候補値で 100 試行のモンテカルロを実行</li>
                <li>目標成功率（既定 90%）を満たす最大値を返す</li>
                <li>探索範囲: 月5万 〜 max(現在支出×3, 月100万)</li>
              </ol>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">日本独自の補正</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>特定口座の譲渡益課税（20.315%）が含まれる</li>
                <li>金現物の総合課税（50万特別控除 + 1/2課税）</li>
                <li>iDeCo の退職所得課税</li>
                <li>退職翌年の住民税ショック（前年所得 × 約10%）</li>
                <li>公的年金等控除後の雑所得課税</li>
              </ul>
            </div>
          </div>
        }
        example={
          <ExampleCard>
            <h4 className="text-sm font-medium">計算結果の使い方</h4>
            <div className="space-y-2 text-sm">
              <p>
                結果画面の成功率カード直下に「90% を維持できる月額支出: X 万円」と表示されます。
              </p>
              <p>
                <strong>vsBengen4Pct</strong> が負なら 4% ルールより保守的、
                正なら積極的に取り崩せる前提です。
              </p>
              <p className="text-muted-foreground">
                参考: William Bengen "Determining Withdrawal Rates Using Historical Data" (1994)
              </p>
            </div>
          </ExampleCard>
        }
      />

      <p className="text-xs text-muted-foreground">
        計算: <code>calcSWR</code>（src/lib/swr/engine.ts）
      </p>
    </section>
  );
}
