import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Flame,
  ArrowRight,
  BookOpen,
  Shield,
} from "lucide-react";

interface GuidePageProps {
  onBack: () => void;
}

export function GuidePage({ onBack }: GuidePageProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← 戻る
        </Button>
      </div>

      {/* 導入 */}
      <div className="mb-10">
        <h2 className="text-2xl font-bold mb-2">はじめに</h2>
        <p className="text-muted-foreground">
          日本の税制を正確に反映したFIREシミュレーター。確率を出すだけでなく、成功率を上げる方法を逆算する。
        </p>
      </div>

      {/* 基本フロー */}
      <section className="mb-12">
        <h3 className="text-xl font-bold mb-6 pb-2 border-b">基本の流れ</h3>
        <div className="space-y-8">
          <FlowStep
            number={1}
            title="パラメータを入力する"
            action="トップ画面の「クイックスタート」に年齢・年収・資産総額を入れて「シミュレーション開始」を押す。"
            tip="3項目だけで始められる。年金・退職金・ライフイベントは「詳しく設定する」で後から追加可能。"
          />
          <FlowStep
            number={2}
            title="成功率と資産推移を読む"
            action="結果画面に FIRE成功確率（%）と資産推移チャート（パーセンタイル帯）が表示される。"
            tip="90%以上 = 堅実、50〜80% = 調整の余地あり。チャートのp5（下位5%）ラインが0になる年齢が「最悪ケースの枯渇年齢」。"
          />
          <FlowStep
            number={3}
            title="処方箋で成功率を上げる"
            action="成功率90%未満のとき、処方箋セクションが自動で開く。提案（例: 月支出−3万円）をタップすると即反映・再計算される。"
            tip="4軸ある: 支出削減 / 退職延期 / 収入増加 / アロケーション最適化。「難易度」タグで実現しやすさを判断できる。"
          />
          <FlowStep
            number={4}
            title="What-if スライダーで探索する"
            action="結果画面のスライダーで退職年齢や月間支出を動かすと、リアルタイムに再計算される。"
            tip="「月5万減らしたら成功率が何%動くか」を体感できる。前回比の差分（+3%等）が成功率の下に表示される。"
          />
          <FlowStep
            number={5}
            title="シナリオを保存・比較する"
            action="入力画面の「シナリオ」セクションで名前を付けて保存。2件以上保存するとヘッダーに「シナリオ比較」が出る。"
            tip="JSONエクスポートでバックアップ可能。共有ボタンでURLを生成すれば、他の端末でも同じパラメータで再現できる。"
          />
        </div>
      </section>

      {/* 注意事項 */}
      <section className="mb-10">
        <h3 className="text-xl font-bold mb-6 pb-2 border-b">知っておくべきこと</h3>
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3">
            <BookOpen className="h-4 w-4 mt-1 text-muted-foreground shrink-0" aria-hidden="true" />
            <p>
              <strong>計算根拠は全公開</strong> — ヘッダーの「計算根拠」から、すべての税率・控除額・計算ロジックを確認できる。2026年度の税制設定ファイル（JSON）から数値を参照しており、計算例はエンジン関数の実行結果。
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="h-4 w-4 mt-1 text-muted-foreground shrink-0" aria-hidden="true" />
            <p>
              <strong>データは端末内に完結</strong> — 入力データは一切サーバーに送信されない。すべてブラウザ内のWeb Workerで計算される。共有URLもデータをURL内に圧縮しているだけで、サーバーに保存されない。
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Flame className="h-4 w-4 mt-1 text-muted-foreground shrink-0" aria-hidden="true" />
            <p>
              <strong>投資助言ではない</strong> — 本ツールは確率的シミュレーションであり、将来の投資成果を保証しない。実際の資産運用・税務処理は専門家に相談すること。
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="text-center pb-8">
        <Button size="lg" onClick={onBack} className="gap-2">
          シミュレーションを始める
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function FlowStep({ number, title, action, tip }: {
  number: number;
  title: string;
  action: string;
  tip: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold"
          aria-hidden="true"
        >
          {number}
        </div>
        {number < 5 && <div className="w-px flex-1 bg-border mt-2" aria-hidden="true" />}
      </div>
      <div className="pb-2">
        <p className="font-medium mb-1">{title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">{action}</p>
        <p className="text-xs text-muted-foreground/80 leading-relaxed border-l-2 border-muted pl-3">
          💡 {tip}
        </p>
      </div>
    </div>
  );
}
