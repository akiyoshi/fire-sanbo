import { useState, useMemo, useCallback } from "react";
import { optimizePortfolio, selectRecommended } from "@/lib/portfolio/optimizer";
import { ASSET_CLASS_IDS, getAssetClassData } from "@/lib/portfolio";
import type { AssetClassId, PortfolioEntry, TaxCategory } from "@/lib/portfolio";
import type { EfficientFrontierPoint } from "@/lib/portfolio/optimizer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const assetClassData = getAssetClassData();
const INVESTABLE = ASSET_CLASS_IDS.filter((id) => id !== "cash");

interface PortfolioOptimizerProps {
  currentPortfolio: PortfolioEntry[];
  onApply: (newPortfolio: PortfolioEntry[]) => void;
}

function WeightBar({ label, weight, className }: { label: string; weight: number; className?: string }) {
  const pct = Math.round(weight * 100);
  if (pct === 0) return null;
  return (
    <div className={`flex items-center gap-2 text-sm ${className ?? ""}`}>
      <span className="w-24 truncate">{label}</span>
      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
        <div
          className="h-full bg-primary/70 rounded"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right font-bold tabular-nums">{pct}%</span>
    </div>
  );
}

function FrontierChart({ frontier, recommended }: { frontier: EfficientFrontierPoint[]; recommended: EfficientFrontierPoint }) {
  if (frontier.length < 2) return null;

  const minR = frontier[0].risk;
  const maxR = frontier[frontier.length - 1].risk;
  const minE = Math.min(...frontier.map((p) => p.expectedReturn));
  const maxE = Math.max(...frontier.map((p) => p.expectedReturn));
  const rangeR = maxR - minR || 1;
  const rangeE = maxE - minE || 1;

  const W = 280;
  const H = 160;
  const PAD = 30;

  const toX = (r: number) => PAD + ((r - minR) / rangeR) * (W - PAD * 2);
  const toY = (e: number) => H - PAD - ((e - minE) / rangeE) * (H - PAD * 2);

  const points = frontier.map((p) => `${toX(p.risk)},${toY(p.expectedReturn)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[320px]">
      {/* Grid */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" strokeOpacity={0.2} />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="currentColor" strokeOpacity={0.2} />
      {/* Labels */}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.5}>リスク →</text>
      <text x={4} y={H / 2} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.5} transform={`rotate(-90,4,${H / 2})`}>リターン →</text>
      {/* Frontier line */}
      <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
      {/* Frontier dots */}
      {frontier.map((p, i) => (
        <circle key={i} cx={toX(p.risk)} cy={toY(p.expectedReturn)} r={2.5} fill="hsl(var(--primary))" opacity={0.5} />
      ))}
      {/* Recommended point */}
      <circle
        cx={toX(recommended.risk)}
        cy={toY(recommended.expectedReturn)}
        r={5}
        fill="hsl(var(--primary))"
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
    </svg>
  );
}

export function PortfolioOptimizer({ currentPortfolio, onApply }: PortfolioOptimizerProps) {
  const [open, setOpen] = useState(false);
  const [riskTolerance, setRiskTolerance] = useState(0.5);
  const [selectedAssets, setSelectedAssets] = useState<Set<AssetClassId>>(
    () => new Set(INVESTABLE),
  );

  const toggleAsset = useCallback((id: AssetClassId) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev; // 最低1つは必要
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const result = useMemo(() => {
    const assets = INVESTABLE.filter((id) => selectedAssets.has(id));
    return optimizePortfolio(assets, 0.5, 10000); // riskToleranceはフロンティアに影響しない
  }, [selectedAssets]);

  const recommended = useMemo(
    () => selectRecommended(result.frontier, riskTolerance),
    [result.frontier, riskTolerance],
  );

  const handleApply = useCallback(() => {
    const rec = recommended;
    const totalAmount = currentPortfolio.reduce((s, e) => s + e.amount, 0);
    if (totalAmount === 0) return;

    // 既存の課税種別割合を保存
    const taxRatios: Record<TaxCategory, number> = {
      nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0,
    };
    for (const entry of currentPortfolio) {
      taxRatios[entry.taxCategory] += entry.amount;
    }
    // デフォルト: 全額NISAにフォールバック（ポートフォリオが空の場合）
    const taxTotal = Object.values(taxRatios).reduce((a, b) => a + b, 0);
    const defaultTaxCategory: TaxCategory = taxTotal > 0
      ? (Object.entries(taxRatios).sort((a, b) => b[1] - a[1])[0][0] as TaxCategory)
      : "nisa";

    // 主要な課税種別を使って最適配分をポートフォリオエントリに変換
    const newEntries: PortfolioEntry[] = [];
    for (const id of INVESTABLE) {
      const w = rec.weights[id];
      if (w < 0.01) continue; // 1%未満は除外
      const amount = Math.round(totalAmount * w);
      // 金は金現物、それ以外は最大の課税種別
      const taxCat: TaxCategory = id === "gold" ? "gold_physical" : defaultTaxCategory;
      newEntries.push({ assetClass: id, taxCategory: taxCat, amount });
    }

    if (newEntries.length > 0) {
      onApply(newEntries);
      setOpen(false);
    }
  }, [recommended, currentPortfolio, onApply]);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        📊 最適配分を提案
      </Button>
    );
  }

  const rec = recommended;
  const riskLabel =
    riskTolerance <= 0.2
      ? "保守的"
      : riskTolerance <= 0.5
        ? "バランス"
        : riskTolerance <= 0.8
          ? "積極的"
          : "攻撃的";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>ポートフォリオ最適化</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>✕</Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 資産クラス選択 */}
        <div>
          <p className="text-sm font-medium mb-2">投資対象</p>
          <div className="flex flex-wrap gap-1.5">
            {INVESTABLE.map((id) => (
              <button
                key={id}
                onClick={() => toggleAsset(id)}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  selectedAssets.has(id)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent"
                }`}
              >
                {assetClassData[id].label}
              </button>
            ))}
          </div>
        </div>

        {/* リスク許容度 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">リスク許容度</span>
            <span className="font-bold">{riskLabel}（{Math.round(riskTolerance * 100)}%）</span>
          </div>
          <Slider
            value={[riskTolerance]}
            onValueChange={(v) => setRiskTolerance(Array.isArray(v) ? v[0] : v)}
            min={0}
            max={1}
            step={0.05}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>安全重視</span>
            <span>リターン重視</span>
          </div>
        </div>

        {/* 効率的フロンティア */}
        <div className="flex justify-center">
          <FrontierChart frontier={result.frontier} recommended={rec} />
        </div>

        {/* 推奨配分 */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">推奨配分</p>
          {INVESTABLE.map((id) => (
            <WeightBar
              key={id}
              label={assetClassData[id].label}
              weight={rec.weights[id]}
            />
          ))}
          <div className="flex gap-4 text-sm mt-2 pt-2 border-t">
            <span>期待リターン <strong>{(rec.expectedReturn * 100).toFixed(1)}%</strong></span>
            <span>リスク <strong>{(rec.risk * 100).toFixed(1)}%</strong></span>
          </div>
        </div>

        {/* 適用ボタン */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleApply} className="flex-1">
            この配分を適用
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            閉じる
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          ※ モンテカルロ法による近似。実際の投資判断はご自身の責任で行ってください。
        </p>
      </CardContent>
    </Card>
  );
}
