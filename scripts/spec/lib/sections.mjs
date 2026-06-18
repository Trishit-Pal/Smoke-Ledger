import { matchGlob } from './glob.mjs'

export function sectionMatches(section, filePath) {
  return (section.sources || []).some((g) => matchGlob(g, filePath))
}

export function affectedSections(manifest, changedFiles) {
  const files = changedFiles.map((f) => String(f).replace(/\\/g, '/'))
  return manifest.sections
    .filter((s) => files.some((f) => sectionMatches(s, f)))
    .map((s) => s.id)
}
