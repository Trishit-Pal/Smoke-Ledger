import { readFileSync, writeFileSync } from 'node:fs'

const STATUSES = ['current', 'drifting', 'stale', 'manual']

export function validateManifest(obj) {
  if (!obj || typeof obj !== 'object') return ['manifest must be an object']
  if (!Array.isArray(obj.sections)) return ['manifest.sections must be an array']
  const errors = []
  const ids = new Set()
  obj.sections.forEach((s, i) => {
    const at = `sections[${i}]`
    if (!s.id) errors.push(`${at}.id is required`)
    else if (ids.has(s.id)) errors.push(`${at}.id "${s.id}" is duplicated`)
    else ids.add(s.id)
    if (!s.file) errors.push(`${at}.file is required`)
    if (!Array.isArray(s.sources)) errors.push(`${at}.sources must be an array`)
    if (!('last_verified_commit' in s)) errors.push(`${at}.last_verified_commit is required (null if never verified)`)
    if (s.status && !STATUSES.includes(s.status)) errors.push(`${at}.status "${s.status}" is invalid`)
  })
  return errors
}

export function loadManifest(path) {
  const obj = JSON.parse(readFileSync(path, 'utf8'))
  const errors = validateManifest(obj)
  if (errors.length) throw new Error(`Invalid manifest at ${path}:\n- ${errors.join('\n- ')}`)
  return obj
}

export function saveManifest(path, manifest) {
  const errors = validateManifest(manifest)
  if (errors.length) throw new Error(`Refusing to save invalid manifest:\n- ${errors.join('\n- ')}`)
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
}
