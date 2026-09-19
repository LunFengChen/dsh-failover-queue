import { routeKey } from './queue.ts'
import type { CircuitHealth, CircuitState, QueueRoute } from './types.ts'

/** Closed / Open / HalfOpen knobs. Chat-friendly defaults, CC Switch-shaped. */
export interface CircuitConfig {
  /** Consecutive failures that open a Closed breaker. */
  readonly failureThreshold: number
  /** Consecutive HalfOpen successes that close the breaker. */
  readonly successThreshold: number
  /** Milliseconds an Open breaker waits before becoming HalfOpen. */
  readonly timeoutMs: number
}

/** Default: 2 failures, 2 probe successes, 60s Open. */
export const DEFAULT_CIRCUIT: CircuitConfig = {
  failureThreshold: 2,
  successThreshold: 2,
  timeoutMs: 60_000,
}

/** Result of taking a HalfOpen probe permit. */
export interface ProbeDecision {
  readonly allowed: boolean
  readonly halfOpen: boolean
}

/** One queue pick: first Closed, else first HalfOpen. */
export interface CircuitPick {
  readonly index: number
  readonly route: QueueRoute
  readonly halfOpen: boolean
}

/**
 * One route's Closed / Open / HalfOpen breaker.
 *
 * HalfOpen allows a single in-flight probe. Open becomes HalfOpen after
 * `timeoutMs`. Immediate failures (AUTH / RATE_LIMIT / NO_ADAPTER) open on
 * the first hit. Memory-only: a process restart starts Closed.
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failures = 0
  private successes = 0
  private openedAt: number | null = null
  private halfOpenPermit = 0

  /**
   * @param config - thresholds and Open timeout.
   */
  constructor(private readonly config: CircuitConfig) {}

  /** Copy of counters for badges and tests. */
  snapshot(): {
    readonly state: CircuitState
    readonly failures: number
    readonly successes: number
    readonly openedAt: number | null
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      openedAt: this.openedAt,
    }
  }

  /**
   * Whether this route may be selected. Open → HalfOpen when the wait elapses.
   * Does not consume the probe permit.
   * @param now - epoch ms.
   */
  isAvailable(now: number): boolean {
    this.maybeHalfOpen(now)
    return this.state === 'closed' || this.state === 'half_open'
  }

  /**
   * Reserve this route for one request. HalfOpen consumes the single permit.
   * @param now - epoch ms.
   */
  allowProbe(now: number): ProbeDecision {
    this.maybeHalfOpen(now)
    if (this.state === 'closed') return { allowed: true, halfOpen: false }
    if (this.state === 'half_open') {
      if (this.halfOpenPermit >= 1) return { allowed: false, halfOpen: true }
      this.halfOpenPermit = 1
      return { allowed: true, halfOpen: true }
    }
    return { allowed: false, halfOpen: false }
  }

  /** Probe succeeded. Two successes close a HalfOpen breaker. */
  recordSuccess(): void {
    this.releaseProbe()
    this.failures = 0
    if (this.state !== 'half_open') return
    this.successes += 1
    if (this.successes >= this.config.successThreshold) this.transitionClosed()
  }

  /**
   * Probe or Closed request failed.
   * @param now - epoch ms used as Open timestamp.
   * @param immediate - open on this hit regardless of `failureThreshold`.
   */
  recordFailure(now: number, immediate = false): void {
    this.releaseProbe()
    this.failures += 1
    this.successes = 0
    if (this.state === 'half_open' || immediate || this.failures >= this.config.failureThreshold) {
      this.transitionOpen(now)
    }
  }

  /** Drop the HalfOpen permit without changing health (cancel / abandon). */
  releaseProbe(): void {
    this.halfOpenPermit = 0
  }

  private maybeHalfOpen(now: number): void {
    if (this.state !== 'open' || this.openedAt === null) return
    if (now - this.openedAt < this.config.timeoutMs) return
    this.state = 'half_open'
    this.successes = 0
    this.halfOpenPermit = 0
  }

  private transitionOpen(now: number): void {
    this.state = 'open'
    this.openedAt = now
    this.successes = 0
    this.halfOpenPermit = 0
  }

  private transitionClosed(): void {
    this.state = 'closed'
    this.failures = 0
    this.successes = 0
    this.openedAt = null
    this.halfOpenPermit = 0
  }
}

/** Per-route breaker map. Missing keys start Closed. */
export class CircuitBank {
  private readonly breakers = new Map<string, CircuitBreaker>()

  /**
   * @param config - shared knobs for every route.
   */
  constructor(private readonly config: CircuitConfig) {}

  /**
   * Breaker for one provider+model pair.
   * @param key - {@link routeKey}.
   */
  get(key: string): CircuitBreaker {
    const existing = this.breakers.get(key)
    if (existing !== undefined) return existing
    const created = new CircuitBreaker(this.config)
    this.breakers.set(key, created)
    return created
  }

  /**
   * Badge rows for the live queue. Touches `isAvailable` so Open can show
   * HalfOpen after the wait without consuming a permit.
   * @param queue - ordered routes.
   * @param now - epoch ms.
   */
  health(queue: readonly QueueRoute[], now: number): CircuitHealth[] {
    return queue.map((route) => {
      const breaker = this.get(routeKey(route))
      breaker.isAvailable(now)
      const snap = breaker.snapshot()
      return {
        provider: route.provider,
        model: route.model,
        state: snap.state,
        failures: snap.failures,
      }
    })
  }
}

/**
 * First Closed route, else first HalfOpen with a free permit. Never sticky.
 * @param queue - P1…Pn.
 * @param bank - per-route breakers.
 * @param now - epoch ms.
 * @param skip - route key to ignore (the attempt that just failed).
 */
export function pickFirstAvailable(
  queue: readonly QueueRoute[],
  bank: CircuitBank,
  now: number,
  skip?: string,
): CircuitPick | undefined {
  for (let index = 0; index < queue.length; index += 1) {
    const route = queue[index]
    if (route === undefined) continue
    const key = routeKey(route)
    if (skip !== undefined && key === skip) continue
    const breaker = bank.get(key)
    if (!breaker.isAvailable(now)) continue
    const probe = breaker.allowProbe(now)
    if (!probe.allowed) continue
    return { index, route, halfOpen: probe.halfOpen }
  }
  return undefined
}

/**
 * Queue index of the first available route, without consuming a probe permit.
 * @param queue - P1…Pn.
 * @param bank - per-route breakers.
 * @param now - epoch ms.
 * @param skip - route key to ignore.
 */
export function firstAvailableIndex(
  queue: readonly QueueRoute[],
  bank: CircuitBank,
  now: number,
  skip?: string,
): number | undefined {
  for (let index = 0; index < queue.length; index += 1) {
    const route = queue[index]
    if (route === undefined) continue
    const key = routeKey(route)
    if (skip !== undefined && key === skip) continue
    if (bank.get(key).isAvailable(now)) return index
  }
  return undefined
}

/**
 * Badge tone for one queue row.
 * @param health - host snapshot for this route, if any.
 */
export function circuitTone(health: CircuitHealth | undefined): 'ok' | 'probe' | 'open' {
  if (health === undefined) return 'ok'
  if (health.state === 'open') return 'open'
  if (health.state === 'half_open') return 'probe'
  return health.failures > 0 ? 'probe' : 'ok'
}

/**
 * Match a queue route to a health row.
 * @param route - queue slot.
 * @param circuits - host snapshot.
 */
export function healthFor(
  route: QueueRoute,
  circuits: readonly CircuitHealth[],
): CircuitHealth | undefined {
  return circuits.find(row => row.provider === route.provider && row.model === route.model)
}
