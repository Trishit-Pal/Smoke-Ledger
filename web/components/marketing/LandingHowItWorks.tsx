import { Text } from '@web/components/ui/Text';

const STEPS = [
  {
    step: '1',
    title: 'Create your free account',
    body: 'Sign up, confirm email, and accept privacy consents.',
  },
  {
    step: '2',
    title: 'Set baseline and brands',
    body: 'Share your usual intake and pick your brands.',
  },
  {
    step: '3',
    title: 'Log daily, watch progress',
    body: 'One-tap logging fills your dashboard and trends.',
  },
] as const;

export function LandingHowItWorks() {
  return (
    <section aria-labelledby="landing-how-heading" className="py-xl px-lg md:px-xl bg-bg-elevated/30">
      <div className="max-w-5xl mx-auto flex flex-col gap-lg">
        <div className="text-center">
          <Text variant="caption" muted>
            HOW IT WORKS
          </Text>
          <h2 id="landing-how-heading" className="text-h2 font-semibold font-serif text-text mt-sm">
            Three steps to clarity
          </h2>
        </div>
        <ol className="grid gap-md md:grid-cols-3">
          {STEPS.map((s) => (
            <li
              key={s.step}
              className="rounded-xl border border-border bg-card p-lg flex flex-col gap-sm shadow-[var(--shadow-card)]"
            >
              <span className="text-h2 font-serif text-accent">{s.step}</span>
              <Text variant="h3">{s.title}</Text>
              <Text variant="small" muted>
                {s.body}
              </Text>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
