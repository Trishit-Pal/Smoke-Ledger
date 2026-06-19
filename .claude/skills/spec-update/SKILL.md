---
name: spec-update
description: Refresh the docs/spec mother book after a change — updates ONLY the sections the diff touches, then records the change. Use after finishing a feature, before a commit, or whenever code and spec may have diverged.
---

# Updating the Spec

You keep `docs/spec/` accurate without rewriting the whole book. Touch only what changed.

## Steps

1. **Find the base.** Default to `main`. If the user names a base ref, use it.

2. **Compute the affected sections deterministically:**
   ```
   node scripts/spec/affected.mjs <base>
   ```
   This prints `{ base, sections, files }`. If `sections` is empty, tell the user
   the spec is already current for this diff and stop.

3. **Read the template once:** `docs/spec/_meta/section-template.md`. Its shape and
   its VOICE rule are mandatory for everything you write.

4. **For each affected section, and ONLY those sections:**
   - Read the current section file (`docs/spec/<file>` from the manifest).
   - Read the changed files for that section (from the `files` list, filtered to
     that section's globs — or just read the ones that look relevant).
   - Rewrite the section so it matches the code now. Preserve the template shape
     and voice. Keep `Open gaps` honest. Do not invent behavior you did not see
     in the code.
   - Set the section's `last_verified_commit` in BOTH the file frontmatter and
     `docs/spec/_meta/spec-manifest.json` to the current HEAD sha
     (`git rev-parse --short HEAD`). Set `status: current`.

5. **Record it.** Prepend an entry to `docs/spec/_meta/CHANGELOG.md`:
   ```
   ## <YYYY-MM-DD> — <sha>
   - <section-id>: <one human line on what changed>
   ```

6. **Self-check.** Re-read each rewritten section for placeholders, contradictions,
   or stilted phrasing. Fix inline.

7. **Verify:** run `npm run spec:drift`. The sections you updated should now read
   `ok`. Report the result.

## Token discipline (the point of this skill)
Never open a section that `affected.mjs` did not name. Never read an unchanged
file. The cost of an update is (changed sections × their changed files) — keep it
there.

## After the run
Save anything you learned about THIS repo's spec conventions (a glob that should
be added to the manifest, a recurring kind of change) as a one-line note for
your future self in `.claude/agent-memory/spec-update.md` (create if absent,
append-only, keep it under ~40 lines — prune oldest if longer).
