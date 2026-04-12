import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "./progress-bar";
import { TableOfContents, MobileToc } from "./table-of-contents";
import type { TocGroup } from "./table-of-contents";
import { IncomeTaxSection } from "./sections/income-tax";
import { SocialInsuranceSection } from "./sections/social-insurance";
import { RetirementTaxSection } from "./sections/retirement-tax";
import { PensionSection } from "./sections/pension";
import { SideIncomeSection } from "./sections/side-income";
import { WithdrawalTaxSection } from "./sections/withdrawal-tax";
import { WithdrawalOrderSection } from "./sections/withdrawal-order";
import { NisaRulesSection } from "./sections/nisa-rules";
import { PortfolioReturnSection } from "./sections/portfolio-return";
import { AssetClassesSection } from "./sections/asset-classes";
import { MonteCarloSection } from "./sections/monte-carlo";
import { SimulationFlowSection } from "./sections/simulation-flow";
import taxConfig from "@/config/tax-config-2026.json";

const TOC_GROUPS: TocGroup[] = [
  {
    label: "収入と税金",
    anchorId: "grp-income",
    sections: [
      { id: "sec-1", label: "1. 給与の手取り計算" },
      { id: "sec-2", label: "2. 社会保険料" },
      { id: "sec-3", label: "3. 退職金の税金" },
      { id: "sec-4", label: "4. 公的年金" },
      { id: "sec-5", label: "5. 副収入の税金" },
    ],
  },
  {
    label: "資産の取り崩し",
    anchorId: "grp-withdrawal",
    sections: [
      { id: "sec-6", label: "6. 口座の取り崩し税" },
      { id: "sec-7", label: "7. 取り崩し順序の根拠" },
      { id: "sec-8", label: "8. NISA積立ルール" },
    ],
  },
  {
    label: "シミュレーションの仕組み",
    anchorId: "grp-simulation",
    sections: [
      { id: "sec-9", label: "9. ポートフォリオリターン" },
      { id: "sec-10", label: "10. 資産クラスのパラメータ" },
      { id: "sec-11", label: "11. モンテカルロ法" },
      { id: "sec-12", label: "12. 年次シミュレーションの流れ" },
    ],
  },
];

interface MethodologyPageProps {
  onBack: () => void;
}

export function MethodologyPage({ onBack }: MethodologyPageProps) {
  // ページ遷移時にトップにスクロール
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <ProgressBar />
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button variant="outline" size="sm" onClick={onBack}>
            ← 戻る
          </Button>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold">計算根拠書</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {taxConfig.fiscalYear}年度版 — 最終更新: {taxConfig.lastUpdated}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            FIRE参謀が使用する計算ルールの一覧です。
            すべての数値は設定ファイル（tax-config-2026.json）から参照しており、
            計算例はエンジン関数の実行結果です。
          </p>
        </div>

        {/* モバイル目次 */}
        <MobileToc groups={TOC_GROUPS} />

        <div className="flex gap-8">
          {/* スティッキー目次 (lg以上) */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-16">
              <TableOfContents groups={TOC_GROUPS} />
            </div>
          </aside>

          {/* メインコンテンツ */}
          <div className="min-w-0 flex-1 space-y-12" role="region" aria-label="計算根拠書本文">
            {/* グループ1: 収入と税金 */}
            <div id="grp-income" className="scroll-mt-20">
              <h2 className="text-xl font-bold mb-6 pb-2 border-b">収入と税金</h2>
              <div className="space-y-10">
                <IncomeTaxSection />
                <SocialInsuranceSection />
                <RetirementTaxSection />
                <PensionSection />
                <SideIncomeSection />
              </div>
            </div>

            {/* グループ2: 資産の取り崩し */}
            <div id="grp-withdrawal" className="scroll-mt-20">
              <h2 className="text-xl font-bold mb-6 pb-2 border-b">資産の取り崩し</h2>
              <div className="space-y-10">
                <WithdrawalTaxSection />
                <WithdrawalOrderSection />
                <NisaRulesSection />
              </div>
            </div>

            {/* グループ3: シミュレーションの仕組み */}
            <div id="grp-simulation" className="scroll-mt-20">
              <h2 className="text-xl font-bold mb-6 pb-2 border-b">シミュレーションの仕組み</h2>
              <div className="space-y-10">
                <PortfolioReturnSection />
                <AssetClassesSection />
                <MonteCarloSection />
                <SimulationFlowSection />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
