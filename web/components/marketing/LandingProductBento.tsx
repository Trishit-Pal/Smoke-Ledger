import { Text } from '@web/components/ui/Text';
import { PreviewDashboard } from '@web/components/marketing/previews/PreviewDashboard';
import { PreviewQuickLog } from '@web/components/marketing/previews/PreviewQuickLog';
import { PreviewTrends } from '@web/components/marketing/previews/PreviewTrends';

export function LandingProductBento() {
  return (
    <section aria-labelledby="landing-preview-heading" className="py-xl px-lg md:px-xl">
      <div className="max-w-5xl mx-auto flex flex-col gap-lg">
        <div className="text-center md:text-left">
          <Text variant="caption" muted>
            PRODUCT PREVIEW
          </Text>
          <h2 id="landing-preview-heading" className="text-h2 font-semibold font-serif text-text mt-sm">
            What you get for free
          </h2>
          <Text variant="small" muted className="mt-sm max-w-2xl">
            Log in seconds, see today&apos;s count and spend, then watch patterns emerge — demo data
            below.
          </Text>
        </div>

        <div className="grid gap-md md:grid-cols-3">
          <PreviewQuickLog />
          <PreviewDashboard />
          <PreviewTrends />
        </div>

        <Text variant="caption" muted className="text-center md:text-left">
          More inside the app: goals, history, and export.
        </Text>
      </div>
    </section>
  );
}
