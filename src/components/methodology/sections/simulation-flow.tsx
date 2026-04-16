import { SourceLink } from "../example-card";

export function SimulationFlowSection() {
  return (
    <section id="sec-12" className="scroll-mt-20 space-y-4">
      <h3 className="text-lg font-semibold">12. 年次シミュレーションの流れ</h3>
      <p className="text-sm text-muted-foreground">
        各試行で「現在の年齢から終了年齢まで」毎年7つのフェーズを順に実行します。
      </p>

      <div className="space-y-3">
        {/* フロー図 */}
        <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto border-l-2 border-primary/30">
          <pre className="whitespace-pre leading-relaxed">{`┌─────────────────────────────────────────────────────┐
│               1年間のシミュレーション                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Phase 1: 収入フェーズ                               │
│  ├─ 在職中? → calcAnnualTax(salary, age) → 手取り    │
│  └─ 配偶者在職中? → 同上                             │
│              ↓                                      │
│  Phase 2: 退職金フェーズ                              │
│  └─ age == retirementAge?                           │
│     → calcRetirementBonusNet() → 特定口座に加算      │
│              ↓                                      │
│  Phase 3: 退職後の収入源                              │
│  ├─ age >= pension.startAge?                        │
│  │  → 年金受給 → calcPensionTax()                    │
│  └─ sideIncome && age <= untilAge?                  │
│     → 副収入 → calcSideIncomeTax()                   │
│              ↓                                      │
│  Phase 4: 支出・取り崩しフェーズ                       │
│  ├─ 年間生活費(×インフレ) + ライフイベント             │
│  ├─ 不足額 = 必要額 − 収入                           │
│  └─ withdrawalOrderに従い口座から取り崩し              │
│     → calcWithdrawalTax() で税額計算                  │
│              ↓                                      │
│  Phase 5: 余剰積立 / 赤字取り崩し                     │
│  ├─ 余剰あり → リバランス有効?                        │
│  │  ├─ Yes → gap順に配分(NISA枠制約付き) [Stage 2]   │
│  │  └─ No  → NISA(枠管理) → 特定口座                 │
│  └─ 赤字 → 口座から追加取り崩し                       │
│              ↓                                      │
│  Phase 6: ポートフォリオリターン                       │
│  ├─ 口座別アロケーション有効? [Stage 1]               │
│  │  ├─ Yes → 口座ごとに独立リターン生成               │
│  │  └─ No  → 全口座に同一リターン                     │
│  └─ 各口座残高 × (1 + ret_i)                         │
│              ↓                                      │
│  Phase 6.5: 退職後リバランス [Stage 3]                │
│  ├─ 乖離 > 閾値(5%)? → 売買実行                      │
│  └─ 特定口座・金の売却益に課税                        │
│              ↓                                      │
│  Phase 7: 年次集計                                   │
│  ├─ 総資産 = nisa + tokutei + ideco + gold + cash    │
│  ├─ 税負担の内訳を記録                               │
│  └─ totalAssets ≤ 0 && retired → 資産枯渇年齢を記録   │
│                                                     │
└─────────── 翌年へ(age + 1) ──────────────────────────┘`}</pre>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium">配偶者がいる場合</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Phase 1-3: 2人分の収入を並行計算</li>
              <li>Phase 4: 生活費は在職者数で均等分担</li>
              <li>Phase 4-5: Primary口座 → Spouse口座の順で取り崩し/積立</li>
            </ul>
          </div>

          <div className="bg-muted rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium">成功/失敗の判定</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>退職後に総資産 ≤ 0 → <span className="text-danger">失敗</span>（資産枯渇）</li>
              <li>終了年齢まで資産が残る → <span className="text-success">成功</span></li>
              <li>成功率 = 成功試行数 / 全試行数</li>
            </ul>
          </div>
        </div>
      </div>

      <SourceLink label="simulation/engine.ts (ソースコード)" url="https://github.com/akiyoshi/fire-sanbo/blob/main/src/lib/simulation/engine.ts" />
    </section>
  );
}
