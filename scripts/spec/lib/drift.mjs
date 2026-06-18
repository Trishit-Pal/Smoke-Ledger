import { sectionMatches } from './sections.mjs'

export function computeDrift(manifest, changedFilesForSection) {
  return manifest.sections.map((s) => {
    if (s.status === 'manual') return { id: s.id, status: 'manual', matched: [] }
    const changed = changedFilesForSection(s) || []
    const matched = changed.filter((f) => sectionMatches(s, String(f).replace(/\\/g, '/')))
    return { id: s.id, status: matched.length ? 'drifting' : 'current', matched }
  })
}

export function hasDrift(report) {
  return report.some((r) => r.status === 'drifting')
}
