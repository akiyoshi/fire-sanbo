import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { optimizePortfolio, selectByMode } from "@/lib/portfolio/optimizer";
import type { OptimizationMode } from "@/lib/portfolio/optimizer";
import { ASSET_CLASS_IDS, getAssetClassData, calcPortfolio } from "@/lib/portfolio";
import type { AssetClassId, PortfolioEntry, TaxCategory, TargetAllocation } from "@/lib/portfolio";
import type { EfficientFrontierPoint } from "@/lib/portfolio/optimizer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const assetClassData = getAssetClassData();
const INVESTABLE = ASSET_CLASS_IDS;

interface PortfolioOptimizerProps {
  currentPortfolio: PortfolioEntry[];
  onApply: (newPortfolio: PortfolioEntry[]) => void;
  /** 目標アロケーションとして適用 */
  onApplyTarget?: (target: TargetAllocation[]) => void;
  /** trueなら常に展開表示（結果画面のdetails内で使用） */
  inline?: boolean;
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

function FrontierChart({ frontier, recommended, currentReturn, currentRisk }: { frontier: EfficientFrontierPoint[]; recommended: EfficientFrontierPoint; currentReturn?: number; currentRisk?: number }) {
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
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" strokeOpacity={0.3} />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="currentColor" strokeOpacity={0.3} />
      {/* Labels */}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.7}>リスク →</text>
      <text x={4} y={H / 2} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.7} transform={`rotate(-90,4,${H / 2})`}>リターン →</text>
      {/* Frontier line */}
      <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
      {/* Frontier dots */}
      {frontier.map((p, i) => (
        <circle key={i} cx={toX(p.risk)} cy={toY(p.expectedReturn)} r={2.5} fill="hsl(var(--primary))" opacity={0.7} />
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
      {/* Current portfolio point */}
      {currentReturn != null && currentRisk != null && (
        <>
          <circle
            cx={toX(Math.max(minR, Math.min(maxR, currentRisk)))}
            cy={toY(Math.max(minE, Math.min(maxE, currentReturn)))}
            r={4}
            fill="none"
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
          />
          <text
            x={toX(Math.max(minR, Math.min(maxR, currentRisk))) + 7}
            y={toY(Math.max(minE, Math.min(maxE, currentReturn))) + 3}
            fontSize={8}
            fill="hsl(var(--destructive))"
          >現在</text>
        </>
      )}
    </svg>
  );
}

export function PortfolioOptimizer({ currentPortfolio, onApply, onApplyTarget, inline }: PortfolioOptimizerProps) {
  const [open, setOpen] = useState(inline ?? false);
  const [mode, setMode] = useState<OptimizationMode>("reduce-risk");
  const [selectedAssets, setSelectedAssets] = useState<Set<AssetClassId>>(
    () => new Set(INVESTABLE),
  );

  const toggleAsset = useCallback((id: AssetClassId) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const currentStats = useMemo(() => {
    if (currentPortfolio.length === 0) return { expectedReturn: 0.05, risk: 0.15 };
    const result = calcPortfolio(currentPortfolio);
    return { expectedReturn: result.expectedReturn, risk: result.risk };
  }, [currentPortfolio]);

  const result = useMemo(() => {
    const assets = INVESTABLE.filter((id) => selectedAssets.has(id));
    return optimizePortfolio(assets, 0.5, 10000);
  }, [selectedAssets]);

  const recommended = useMemo(
    () => selectByMode(result.frontier, currentStats.expectedReturn, currentStats.risk, mode),
    [result.frontier, currentStats.expectedReturn, currentStats.risk, mode],
  );

  const handleApply = useCallback(() => {
    if (!recommended) return;
    const totalAmount = currentPortfolio.reduce((s, e) => s + e.amount, 0);
    if (totalAmount === 0) return;

    const taxRatios: Record<TaxCategory, number> = {
      nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0,
    };
    for (const entry of currentPortfolio) {
      taxRatios[entry.taxCategory] += entry.amount;
    }
    const taxTotal = Object.values(taxRatios).reduce((a, b) => a + b, 0);
    const defaultTaxCategory: TaxCategory = taxTotal > 0
      ? (Object.entries(taxRatios).sort((a, b) => b[1] - a[1])[0][0] as TaxCategory)
      : "nisa";

    const newEntries: PortfolioEntry[] = [];
    for (const id of INVESTABLE) {
      const w = recommended.weights[id];
      if (w < 0.01) continue;
      const amount = Math.round(totalAmount * w);
      const taxCat: TaxCategory = id === "gold" ? "gold_physical" : id === "cash" ? "cash" : defaultTaxCategory;
      newEntries.push({ assetClass: id, taxCategory: taxCat, amount });
    }

    if (newEntries.length > 0) {
      onApply(newEntries);
      setOpen(false);
    }
  }, [recommended, currentPortfolio, onApply]);

  const handleApplyAsTarget = useCallback(() => {
    if (!recommended) return;
    const targetEntries: TargetAllocation[] = [];
    for (const id of INVESTABLE) {
      const w = recommended.weights[id];
      if (w < 0.01) continue;
      targetEntries.push({ assetClass: id, weight: w });
    }
    if (targetEntries.length > 0 && onApplyTarget) {
      onApplyTarget(targetEntries);
      setOpen(false);
    }
  }, [recommended, onApplyTarget]);

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || inline) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handler);
  }, [open, inline]);

  if (!open && !inline) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        📊 最適配分を提案
      </Button>
    );
  }

  const modeLabel = mode === "reduce-risk" ? "安全化" : "効率化";
  const retDelta = recommended ? (recommended.expectedReturn - currentStats.expectedReturn) * 100 : 0;
  const riskDelta = recommended ? (recommended.risk - currentStats.risk) * 100 : 0;

  const content = (
    <div className="space-y-4">
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

        {/* 最適化モード選択 */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">最適化の方向</legend>
          <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${mode === "reduce-risk" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}>
            <input
              type="radio"
              name="opt-mode"
              value="reduce-risk"
              checked={mode === "reduce-risk"}
              onChange={() => setMode("reduce-risk")}
              className="accent-primary"
            />
            <div>
              <span className="text-sm font-medium">同じリターンでリスクを下げる</span>
              <span className="block text-xs text-muted-foreground">安全化: 期待リターンを維持しつつ分散効果でリスクを低減</span>
            </div>
          </label>
          <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${mode === "increase-return" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}>
            <input
              type="radio"
              name="opt-mode"
              value="increase-return"
              checked={mode === "increase-return"}
              onChange={() => setMode("increase-return")}
              className="accent-primary"
            />
            <div>
              <span className="text-sm font-medium">同じリスクでリターンを上げる</span>
              <span className="block text-xs text-muted-foreground">効率化: リスク水準を維持しつつ効率的な配分でリターン向上</span>
            </div>
          </label>
        </fieldset>

        {/* 効率的フロンティア */}
        <div className="flex justify-center">
          <FrontierChart frontier={result.frontier} recommended={recommended ?? result.minRisk} currentReturn={currentStats.expectedReturn} currentRisk={currentStats.risk} />
        </div>

        {/* 比較テーブル */}
        {recommended ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div />
              <div className="text-center font-medium text-muted-foreground">現在</div>
              <div className="text-center font-medium text-primary">{modeLabel}後</div>

              <div className="font-medium">リターン</div>
              <div className="text-center tabular-nums">{(currentStats.expectedReturn * 100).toFixed(1)}%</div>
              <div className="text-center tabular-nums">
                {(recommended.expectedReturn * 100).toFixed(1)}%
                {Math.abs(retDelta) >= 0.1 && (
                  <span className={`ml-1 text-xs ${retDelta > 0 ? "text-success" : "text-muted-foreground"}`}>
                    {retDelta > 0 ? "+" : ""}{retDelta.toFixed(1)}%
                  </span>
                )}
              </div>

              <div className="font-medium">リスク</div>
              <div className="text-center tabular-nums">{(currentStats.risk * 100).toFixed(1)}%</div>
              <div className="text-center tabular-nums">
                {(recommended.risk * 100).toFixed(1)}%
                {Math.abs(riskDelta) >= 0.1 && (
                  <span className={`ml-1 text-xs ${riskDelta < 0 ? "text-success" : "text-muted-foreground"}`}>
                    {riskDelta > 0 ? "+" : ""}{riskDelta.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* 推奨配分 */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium">推奨配分</p>
              {INVESTABLE.map((id) => (
                <WeightBar key={id} label={assetClassData[id].label} weight={recommended.weights[id]} />
              ))}
            </div>

            {/* 適用ボタン */}
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <Button onClick={handleApply} className="flex-1">
                  保有に適用
                </Button>
                {onApplyTarget && (
                  <Button variant="secondary" onClick={handleApplyAsTarget} className="flex-1">
                    目標に設定
                  </Button>
                )}
              </div>
              {!inline && (
              <Button variant="outline" onClick={() => setOpen(false)} className="w-full">
                閉じる
              </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              現在のポートフォリオは既にフロンティア上にあり、
              {mode === "reduce-risk" ? "同リターンでのリスク低減" : "同リスクでのリターン向上"}の余地がありません。
            </p>
            <Button variant="outline" onClick={() => setMode(mode === "reduce-risk" ? "increase-return" : "reduce-risk")} className="mt-2" size="sm">
              {mode === "reduce-risk" ? "効率化モードを試す" : "安全化モードを試す"}
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          ※ モンテカルロ法による近似。実際の投資判断はご自身の責任で行ってください。
        </p>
      </div>
  );

  if (inline) return content;

  return (
    <Card ref={dialogRef} role="dialog" aria-modal="true" aria-label="ポートフォリオ最適化" tabIndex={-1} className="outline-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>ポートフォリオ最適化</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="閉じる"><X className="h-4 w-4" aria-hidden="true" /></Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
