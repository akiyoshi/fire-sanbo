interface ExampleCardProps {
  children: React.ReactNode;
}

/** 計算例カード（右カラムに表示される bg-muted のハイライトブロック） */
export function ExampleCard({ children }: ExampleCardProps) {
  return (
    <div className="bg-muted rounded-lg p-4 space-y-2">
      <p className="text-xs font-medium text-muted-foreground" aria-hidden="true">
        📝 計算例
      </p>
      {children}
    </div>
  );
}

/** 計算ステップの矢印表記（税金系セクション用） */
export function Step({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-muted-foreground" aria-hidden="true">→</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** 計算例の入力値ヘッダー */
export function ExampleInput({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm font-medium pb-1 border-b border-border/50">
      {label}: <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** 出典リンク */
export function SourceLink({ label, url }: { label: string; url: string }) {
  return (
    <p className="text-xs text-muted-foreground mt-4">
      出典:{" "}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-foreground"
      >
        {label}
      </a>
    </p>
  );
}

/** 2カラムレイアウト: ルール説明(左) + 計算例(右) */
export function TwoColumn({ rule, example }: { rule: React.ReactNode; example: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>{rule}</div>
      <div>{example}</div>
    </div>
  );
}

/** 金額フォーマット */
export function fmtYen(n: number): string {
  const man = Math.round(n / 10000);
  if (Math.abs(man) >= 10000) {
    const oku = man / 10000;
    return oku % 1 === 0 ? `${oku}億円` : `${oku.toFixed(1)}億円`;
  }
  return `${man.toLocaleString()}万円`;
}

export function fmtExact(n: number): string {
  return `${n.toLocaleString()}円`;
}

export function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}
