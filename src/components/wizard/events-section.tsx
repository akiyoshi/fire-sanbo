import type { FormState } from "@/lib/form-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface EventsSectionProps {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

export function EventsSection({ form, update }: EventsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>ライフイベント（一時支出）</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const events = [...(form.lifeEvents ?? [])];
              events.push({ id: crypto.randomUUID(), label: "", age: form.currentAge + 5, amount: 0 });
              update("lifeEvents", events);
            }}
          >
            + 追加
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(!form.lifeEvents || form.lifeEvents.length === 0) ? (
          <p className="text-xs text-muted-foreground">
            住宅購入・教育費・結婚・車など、特定の年齢で発生する大きな支出を追加できます。
          </p>
        ) : (
          form.lifeEvents.map((event, i) => (
            <div key={event.id ?? i} className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:items-center border-b pb-3 last:border-b-0 last:pb-0">
              <Input
                type="text"
                placeholder="イベント名"
                aria-label="イベント名"
                value={event.label}
                onChange={(e) => {
                  const events = [...form.lifeEvents!];
                  events[i] = { ...events[i], label: e.target.value };
                  update("lifeEvents", events);
                }}
                className="sm:w-[30%]"
              />
              <div className="flex items-center gap-1 sm:w-[20%]">
                <Input
                  type="number"
                  inputMode="numeric"
                  aria-label="年齢"
                  value={event.age}
                  onChange={(e) => {
                    const events = [...form.lifeEvents!];
                    events[i] = { ...events[i], age: Number(e.target.value) || 0 };
                    update("lifeEvents", events);
                  }}
                  className="text-right"
                  min={form.currentAge}
                  max={form.endAge}
                />
                <span className="text-xs text-muted-foreground">歳</span>
              </div>
              <div className="col-span-full flex items-center gap-2 sm:col-span-1 sm:flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  aria-label="金額"
                  value={event.amount > 0 ? new Intl.NumberFormat("ja-JP").format(event.amount) : ""}
                  placeholder="0"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const events = [...form.lifeEvents!];
                    events[i] = { ...events[i], amount: Math.min(Number(raw) || 0, 1_000_000_000) };
                    update("lifeEvents", events);
                  }}
                  className="text-right"
                />
              </div>
              <span className="text-xs text-muted-foreground">円</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const events = form.lifeEvents!.filter((_, idx) => idx !== i);
                  update("lifeEvents", events);
                }}
                aria-label="削除"
                className="text-muted-foreground px-2"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
