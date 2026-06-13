import { useMemo } from "react";
import {
  calcEffectiveYearsForLumpSum,
  calcCombinedLumpSumNet,
  calcRetirementBonusNet,
} from "@/lib/tax/engine";
import { TwoColumn, ExampleCard } from "../example-card";

/**
 * §16 退職所得控除の重複期間ルール（5/19年ルール）
 *
 * v4.6.5 追加。autoplan §7.1。
 */
export function RetirementOverlapSection() {
  const example = useMemo(() => {
    const ideco = { amount: 8_000_000, yearsOfContribution: 20 };
    const bonus = { amount: 15_000_000, receiveAge: 60, yearsOfService: 30 };

    // 同年受給 (gap=0)
    const sameYear = calcCombinedLumpSumNet(
      { ...ideco, receiveAge: 60 },
      bonus,
    );

    // 5年遅らせる
    const gap5 = calcCombinedLumpSumNet(
      { ...ideco, receiveAge: 65 },
      bonus,
    );

    // 比較用フル控除
    const idecoFull = calcRetirementBonusNet(ideco.amount, ideco.yearsOfContribution);
    const bonusFull = calcRetirementBonusNet(bonus.amount, bonus.yearsOfService);

    return {
      sameYear,
      gap5,
      idecoFull,
      bonusFull,
      improvement: gap5.totalNet - sameYear.totalNet,
    };
  }, []);

  const overlap0 = calcEffectiveYearsForLumpSum(60, 30, 60, 20, 5);
  const overlap5 = calcEffectiveYearsForLumpSum(60, 30, 65, 20, 5);

  return (
    <section id="sec-16" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">16. 退職所得控除の重複期間ルール（5/19年）</h3>
      <p className="text-sm text-muted-foreground">
        退職金と iDeCo 一時金を近い時期に受け取ると、退職所得控除の重複期間が
        後発側から差し引かれます（所得税法施行令70条 + 基本通達30-12）。
      </p>

      <TwoColumn
        rule={
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-2">適用ルール</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>
                  <strong>5年ルール</strong>: iDeCo 一時金（先）→ 退職金（後）
                  受給年差 ≥ 5 でフル控除
                </li>
                <li>
                  <strong>19年ルール</strong>: 退職金（先）→ iDeCo 一時金（後）
                  受給年差 ≥ 19 でフル控除
                </li>
                <li>重複期間 = min(両者の年数) − 受給年差</li>
                <li>後発側の控除年数 = max(0, 元の年数 − 重複期間)</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">境界の例（退職勤続30年・iDeCo20年）</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1">gap</th>
                    <th className="text-right py-1">後発の実効年数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="py-1">0</td><td className="text-right">{overlap0} 年</td></tr>
                  <tr><td className="py-1">5</td><td className="text-right">{overlap5} 年（フル）</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        }
        example={
          <ExampleCard>
            <h4 className="text-sm font-medium">例: 退職金1500万 + iDeCo800万</h4>
            <div className="space-y-2 text-sm">
              <div>
                <strong>同年受給（gap=0）</strong>: 重複期間 20 年で控除圧縮 →
                合計手取り {Math.round(example.sameYear.totalNet / 10_000)}万円
              </div>
              <div>
                <strong>iDeCo 5年遅らせ（gap=5）</strong>: フル控除 →
                合計手取り {Math.round(example.gap5.totalNet / 10_000)}万円
              </div>
              <div className="text-success font-medium">
                改善: +{Math.round(example.improvement / 10_000)}万円
              </div>
            </div>
          </ExampleCard>
        }
      />

      <p className="text-xs text-muted-foreground">
        計算: <code>calcEffectiveYearsForLumpSum</code> /{" "}
        <code>calcCombinedLumpSumNet</code>（src/lib/tax/engine.ts）
      </p>
    </section>
  );
}
