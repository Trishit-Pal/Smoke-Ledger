<!--
LinkedIn launch post — Smoke Ledger India
Angle: career / portfolio showcase · Audience: layered (general + builders)
AI tooling: named prominently · CTA: open-to-work
BEFORE PUBLISHING: replace [YOUR-LINK-HERE] with the live Vercel URL
(Part 2, Phase A, step 3 of docs plan). Do not post until the link resolves.
-->

# LinkedIn Launch Post

I spent the last few months building a real, production-grade app almost entirely by orchestrating AI agents — not autocomplete, actual agentic engineering. Here's what shipped, and the bugs that fought back.

**Smoke Ledger** is a calm, private way to track cigarettes and the money they quietly cost you — in ₹.

No shame, no streak-shaming. Just an honest ledger: what you smoked, when, what it cost, and what you're saving as you cut down. For anyone in India who wants to see the real number before deciding what to do about it.

👉 Try it: [YOUR-LINK-HERE]

—

**Under the hood** (for the builders):

One codebase, two runtimes:
• 📱 Mobile — React Native + Expo (SDK 56), iOS & Android
• 🌐 Web — Next.js 14 (App Router), server-rendered
• 🔁 A shared pure-TypeScript domain layer both import — the math for a cigarette is written once and runs everywhere.

Backend: Supabase (Postgres) with Row-Level Security on every table — tenant isolation enforced by the database, not the app. SECURITY DEFINER RPCs for rate-limited writes. Two Deno edge functions for account deletion and tamper-resistant audit logging. Built around India's DPDP Act: real data export, real erasure, and audit rows that prove a deletion happened without re-identifying the person.

—

**Built with AI — and I mean built:**

• 🤖 **Claude Code (Opus 4.8)** as the primary engineer — implementing features, then dispatching *fresh subagents to code-review every change* before merge. A reviewer that doesn't share the author's context catches what the author can't.
• 🔬 **Multi-agent workflows** — e.g. 9 agents in parallel reverse-engineering the codebase into a living specification.
• 🗄️ **Supabase MCP** — live database migrations and security audits straight from the dev loop.
• 📖 A custom **"living spec" system** — docs that drift-check against the code; change the code and a CLI tells me which sections went stale.
• ✅ 262 automated tests (Jest) + Playwright E2E + a mandatory CI job whose only purpose is to try to leak one user's data to another and fail the build if it can.

—

**Three things that broke (and the fix):**

1️⃣ **Cross-device magic links.** Request login on your phone, open the email on your laptop → it failed. The code checked the PKCE `code` (which needs the *same* browser's secret) before the device-agnostic `token_hash`. Reordered the checks — now the link works wherever you open it.

2️⃣ **"But the migration says it's there."** A security constraint lived in the migration file yet was missing from the live database — applied once, then quietly edited after. Lesson: trust the live `pg_constraint`, not the repo. Fixed forward with an idempotent migration and a CI assertion.

3️⃣ **The build Hermes hated.** Supabase's client uses a dynamic import the Hermes engine can't compile — it broke every Android production build. One targeted Metro resolver override (force the CommonJS build for that one package) and it shipped.

(+ bonus: an AI code review caught a celebration that wished users "Happy 0-day streak" because one optional field was quietly `undefined`. One-line fix — and a perfect argument for reviewing *everything*.)

—

I'm a solo developer, and this was as much an experiment in *how* software gets built now as in building the thing itself. The takeaway: AI didn't replace engineering judgment — it amplified how much of it I could apply, across how many layers, at once.

If you're hiring someone who can architect, ship, and orchestrate AI-assisted development end-to-end — or you just want to trade notes on agentic workflows — my inbox is open.

**Two questions, pick your side:**
→ Builders: would you let an AI subagent gate your code reviews?
→ Everyone else: what's the one honest number about a habit you wish an app would just *show* you?

#BuildInPublic #AIAssistedDevelopment #ClaudeCode #ReactNative #NextJS #Supabase #SoloDeveloper #SoftwareEngineering #DPDP
