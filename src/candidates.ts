import { CANDIDATES_MARKER, type FailoverCandidate } from './types.ts'

/**
 * Parse `/failover __candidates` command text into catalog rows.
 * @param text - command success text, possibly including the marker prefix.
 * @returns recognized provider+model rows; unknown text is empty.
 */
export function candidatesFromText(text: string): FailoverCandidate[] {
  const marker = text.indexOf(CANDIDATES_MARKER)
  if (marker < 0) return []
  const json = text.slice(marker + CANDIDATES_MARKER.length).trim()
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((row) => {
      if (typeof row !== 'object' || row === null) return []
      const item = row as Record<string, unknown>
      if (typeof item.provider !== 'string' || typeof item.model !== 'string') return []
      return [{
        provider: item.provider,
        providerName: typeof item.providerName === 'string' ? item.providerName : item.provider,
        model: item.model,
        name: typeof item.name === 'string' ? item.name : item.model,
      }]
    })
  } catch {
    return []
  }
}

/**
 * Flatten `session/modelCatalog` into the same provider+model rows.
 * @param value - RPC value, or undefined when the call failed.
 * @returns one row per model in successful groups.
 */
export function candidatesFromCatalog(value: unknown): FailoverCandidate[] {
  if (typeof value !== 'object' || value === null) return []
  const groups = (value as { groups?: unknown }).groups
  if (!Array.isArray(groups)) return []
  return groups.flatMap((group) => {
    if (typeof group !== 'object' || group === null) return []
    const row = group as { id?: unknown; name?: unknown; models?: unknown }
    if (typeof row.id !== 'string' || !Array.isArray(row.models)) return []
    const providerName = typeof row.name === 'string' ? row.name : row.id
    return row.models.flatMap((model) => {
      if (typeof model !== 'object' || model === null) return []
      const item = model as { id?: unknown; name?: unknown }
      if (typeof item.id !== 'string') return []
      return [{
        provider: row.id,
        providerName,
        model: item.id,
        name: typeof item.name === 'string' ? item.name : item.id,
      }]
    })
  })
}
