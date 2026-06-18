// scripts/spec/lib/git.mjs
import { execFileSync } from 'node:child_process'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean)
}

export function changedFilesSince(commit) {
  return git(['diff', '--name-only', commit, 'HEAD'])
}

export function changedFilesDiff(base) {
  return git(['diff', '--name-only', `${base}...HEAD`])
}

export function trackedFiles() {
  return git(['ls-files'])
}
