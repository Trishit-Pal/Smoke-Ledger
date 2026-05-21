import { Card } from '@web/components/ui/Card';
import { Text } from '@web/components/ui/Text';
import { DEMO_FAVORITE_BRANDS } from '@web/lib/marketing/demoData';

export function PreviewQuickLog() {
  return (
    <Card className="p-lg shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-md">
        <Text variant="caption" muted>
          Quick log
        </Text>
        <Text variant="bodyStrong">Brand A · Regular</Text>
        <Text variant="small" muted>
          ₹16
        </Text>
        <div className="flex gap-sm">
          <div
            className="flex-1 min-h-[48px] rounded-md bg-accent text-white font-semibold flex items-center justify-center text-base"
            aria-hidden
          >
            Log 1
          </div>
          <div
            className="min-h-[48px] min-w-[4rem] rounded-md border border-border bg-bg-elevated font-semibold flex items-center justify-center"
            aria-hidden
          >
            +2
          </div>
        </div>
        <div className="flex flex-wrap gap-xs">
          {DEMO_FAVORITE_BRANDS.map((b) => (
            <span
              key={b.id}
              className="rounded-pill px-md py-xs text-caption font-medium border border-border bg-bg-elevated text-text-muted"
            >
              {b.name}
            </span>
          ))}
        </div>
        <p className="sr-only">
          Demo quick log with one-tap Log 1 and plus 2 buttons plus favorite brand chips.
        </p>
      </div>
    </Card>
  );
}
