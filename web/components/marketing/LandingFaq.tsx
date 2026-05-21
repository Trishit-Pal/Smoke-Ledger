import { Text } from '@web/components/ui/Text';

const FAQ_ITEMS = [
  {
    q: 'Is Smoke Ledger really free?',
    a: 'Yes. Core tracking, trends, and export are free. We do not run ads or sell your data.',
  },
  {
    q: 'Is my data private?',
    a: 'Your logs are protected by authentication and row-level security. Only you can access your account data.',
  },
  {
    q: 'Is this medical advice?',
    a: 'No. Smoke Ledger is behavioral support software for adults 18+. Consult a licensed clinician for medical decisions.',
  },
] as const;

export function LandingFaq() {
  return (
    <section aria-labelledby="landing-faq-heading" className="py-xl px-lg md:px-xl border-t border-border/60">
      <div className="max-w-3xl mx-auto flex flex-col gap-lg">
        <div className="text-center">
          <Text variant="caption" muted>
            FAQ
          </Text>
          <h2 id="landing-faq-heading" className="text-h2 font-semibold font-serif text-text mt-sm">
            Common questions
          </h2>
        </div>
        <div className="flex flex-col gap-sm">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group rounded-lg border border-border bg-card p-md open:shadow-[var(--shadow-card)]"
            >
              <summary className="cursor-pointer list-none font-semibold text-text flex justify-between items-center gap-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded-sm">
                {item.q}
                <span className="text-text-muted group-open:rotate-45 transition-transform" aria-hidden>
                  +
                </span>
              </summary>
              <Text variant="small" muted className="mt-sm">
                {item.a}
              </Text>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
