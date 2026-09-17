import type { FailoverCandidate, QueueRoute } from './types.ts'

/** Stable identity for cooldown and de-dupe. */
export function routeKey(route: QueueRoute): string {
  return `${route.provider}\0${route.model}`
}

/**
 * Clamp a queue index into `[0, length)` (or `0` when empty).
 * @param index - requested index.
 * @param length - queue length.
 * @returns a usable index.
 */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  if (!Number.isFinite(index)) return 0
  const whole = Math.trunc(index)
  if (whole < 0) return 0
  if (whole >= length) return length - 1
  return whole
}

/**
 * Move one queue item from `from` to `to`.
 * @param queue - current ordered routes.
 * @param from - source index.
 * @param to - destination index.
 * @returns a new array.
 */
export function reorderQueue(
  queue: readonly QueueRoute[],
  from: number,
  to: number,
): QueueRoute[] {
  if (from === to) return [...queue]
  if (from < 0 || from >= queue.length) return [...queue]
  if (to < 0 || to >= queue.length) return [...queue]
  const next = [...queue]
  const [item] = next.splice(from, 1)
  if (item === undefined) return next
  next.splice(to, 0, item)
  return next
}

/**
 * Follow the same route after a drag, not the same slot.
 * @param currentIndex - active index before the move.
 * @param from - dragged index.
 * @param to - drop index.
 * @returns the index of the previously active route.
 */
export function indexAfterReorder(currentIndex: number, from: number, to: number): number {
  if (currentIndex === from) return to
  if (from < currentIndex && to >= currentIndex) return currentIndex - 1
  if (from > currentIndex && to <= currentIndex) return currentIndex + 1
  return currentIndex
}

/**
 * Next uncooled route after `currentIndex`, wrapping once.
 * @param queue - ordered routes.
 * @param currentIndex - failed slot.
 * @param isCooled - true when this route should be skipped.
 * @returns the next index, or `undefined` when nothing remains.
 */
export function advanceIndex(
  queue: readonly QueueRoute[],
  currentIndex: number,
  isCooled: (route: QueueRoute) => boolean,
): number | undefined {
  if (queue.length < 2) return undefined
  const start = clampIndex(currentIndex, queue.length)
  for (let step = 1; step < queue.length; step += 1) {
    const index = (start + step) % queue.length
    const route = queue[index]
    if (route !== undefined && !isCooled(route)) return index
  }
  return undefined
}

/**
 * True when this failure should skip remaining same-route retries.
 * @param code - provider-neutral `LlmFailure.code`.
 * @param immediateCodes - configured trip codes.
 */
export function shouldFailoverImmediately(
  code: string,
  immediateCodes: readonly string[],
): boolean {
  return immediateCodes.includes(code)
}

/**
 * Drop duplicate provider+model pairs, keeping the first occurrence.
 * @param queue - possibly messy user input.
 */
export function dedupeQueue(queue: readonly QueueRoute[]): QueueRoute[] {
  const seen = new Set<string>()
  const next: QueueRoute[] = []
  for (const route of queue) {
    const provider = route.provider.trim()
    const model = route.model.trim()
    if (provider === '' || model === '') continue
    const key = routeKey({ provider, model })
    if (seen.has(key)) continue
    seen.add(key)
    next.push({
      provider,
      model,
      ...route.label === undefined || route.label.trim() === ''
        ? {}
        : { label: route.label.trim() },
    })
  }
  return next
}

/**
 * Names the chip and queue rows show for one route.
 * Prefers the live catalog's provider/model titles, then the stored label.
 * @param route - queue slot.
 * @param candidates - advertised catalog, possibly empty.
 */
export function routeDisplay(
  route: QueueRoute,
  candidates: readonly FailoverCandidate[] = [],
): { provider: string; model: string } {
  const hit = candidates.find(row => row.provider === route.provider && row.model === route.model)
  const provider = hit?.providerName.trim() || route.provider
  const model = route.label?.trim() || hit?.name.trim() || route.model
  return { provider, model }
}
