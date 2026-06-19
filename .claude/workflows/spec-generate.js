export const meta = {
  name: 'spec-generate',
  description: 'Generate the docs/spec mother book from real code, one agent per section, resumable.',
  phases: [
    { title: 'Generate', detail: 'one grounded agent per spec section' },
    { title: 'Index', detail: 'write SPEC.md + glossary from the sections' },
  ],
}

const SECTIONS = [
  { id: 'architecture', file: '01-architecture.md', focus: 'monorepo layout, the domain/repo/validation/store/server layers, how data flows, the @/ alias, metro Hermes shim.' },
  { id: 'data-model', file: '02-data-model.md', focus: 'every table, column, CHECK constraint, RLS policy, trigger, and RPC. Mirror the LIVE database, not migration files (they can lie).' },
  { id: 'auth', file: '03-auth.md', focus: 'signup, login (password + magic link), the three Supabase link shapes, cross-device callbacks, password reset, the justCreated flow.' },
  { id: 'identity-profile', file: '04-identity-profile.md', focus: 'identity fields, the fail-closed 18+ gate, immutability of name/dob/gender, the once-per-30-days mobile change, server-owned mobile_changed_at.' },
  { id: 'logging', file: '05-logging.md', focus: 'cigarette logs, the 30/day rate limit RPC, brands and variants, price snapshots.' },
  { id: 'goals-insights', file: '06-goals-insights.md', focus: 'goals, insight/nudge generation, mood x trigger correlations, health milestone detection, INR savings.' },
  { id: 'celebrations', file: '07-celebrations.md', focus: 'isBirthdayToday, birthday vs streak milestones, the character moods, ConfettiBurst, reduce-motion. NOTE the known mobile bug: src/components/character/MilestoneCelebration.tsx shows "0-day streak." for birthdays — record it under Open gaps, do not fix it here.' },
  { id: 'security-privacy', file: '08-security-privacy.md', focus: 'the RLS model, SECURITY DEFINER + search_path hygiene, the DPDP export/erase RPCs, the peppered audit hash, the service-role-only surfaces.' },
  { id: 'infra-ops', file: '09-infra-ops.md', focus: 'Supabase/Vercel/EAS free-tier limits, the CI gates, deployment, the runbooks.' },
]

const SECTION_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, markdown: { type: 'string' }, sourcesVerified: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'markdown'],
}

phase('Generate')
const sections = await parallel(SECTIONS.map((s) => () =>
  agent(
    `Write the "docs/spec/${s.file}" section for Smoke Ledger India. Focus: ${s.focus}\n` +
    `First READ docs/spec/_meta/section-template.md and follow its shape and VOICE rule exactly (human, plain, warm; explain why; no AI cadence).\n` +
    `Ground everything in real evidence: read the code under this section's manifest globs, the relevant tests, and (for data/security) the live DB schema via the Supabase MCP and the memory master_context. Use path:line references. Do not invent behavior.\n` +
    `Return the full markdown for the file (including frontmatter with section id, sources, last_verified_commit: null, status: current).`,
    { label: `spec:${s.id}`, phase: 'Generate', agentType: 'Explore', schema: SECTION_SCHEMA }
  ).then((r) => r ? { ...r, id: s.id } : null)
))

const ok = sections.filter(Boolean)
log(`Generated ${ok.length}/${SECTIONS.length} sections.`)

phase('Index')
const glossary = await agent(
  `Write docs/spec/00-glossary.md: a human glossary of Smoke Ledger India's domain terms ` +
  `(cigarette log, baseline, streak, milestone, mood, trigger, pepper, RLS, DPDP, keyset pagination, etc.). ` +
  `Follow docs/spec/_meta/section-template.md voice. status: manual.`,
  { label: 'spec:glossary', phase: 'Index', schema: SECTION_SCHEMA }
)

return { sections: ok, glossary }
