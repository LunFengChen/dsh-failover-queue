import type { FailoverCandidate, FailoverSettings, QueueRoute } from '../types.ts'
import { DEFAULT_SETTINGS } from '../config.ts'
import { clampIndex, dedupeQueue } from '../queue.ts'

/** Live snapshot published to the chip via the inject hooks seat. */
export interface FailoverSnapshot extends FailoverSettings {
  /** Catalog rows the add list can pick. */
  readonly candidates: readonly FailoverCandidate[]
  /** False until the first catalog/slash-command fetch finishes. */
  readonly candidatesLoaded: boolean
}

const listeners = new Set<() => void>()
let snapshot: FailoverSnapshot = {
  ...DEFAULT_SETTINGS,
  candidates: [],
  candidatesLoaded: false,
}

function publish(next: FailoverSnapshot): void {
  snapshot = next
  for (const listener of [...listeners]) listener()
}

/** Bare observable the slot renderer binds to `useFailover`. */
export const failoverSource = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): FailoverSnapshot {
    return snapshot
  },
}

/**
 * Replace settings fields, keep candidates.
 * @param settings - persisted document.
 */
export function replaceSettings(settings: FailoverSettings): void {
  const queue = dedupeQueue(settings.queue)
  publish({
    enabled: settings.enabled,
    queue,
    currentIndex: clampIndex(settings.currentIndex, queue.length),
    candidates: snapshot.candidates,
    candidatesLoaded: snapshot.candidatesLoaded,
  })
}

/**
 * Replace the add-list catalog.
 * @param candidates - advertised provider+model rows.
 */
export function replaceCandidates(candidates: readonly FailoverCandidate[]): void {
  publish({ ...snapshot, candidates, candidatesLoaded: true })
}

/** Read the current snapshot (event-handler path). */
export function peek(): FailoverSnapshot {
  return snapshot
}

export type { FailoverCandidate, FailoverSettings, QueueRoute }
