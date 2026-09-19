/** One provider+model slot in the failover queue. P1 is index 0. */
export interface QueueRoute {
  /** Adapter route key (`GenerateOptions.provider`). */
  readonly provider: string
  /** Model id for that route. */
  readonly model: string
  /** Optional display label; the chip falls back to `provider/model`. */
  readonly label?: string
}

/** Closed = healthy, Open = skipped, HalfOpen = one probe. */
export type CircuitState = 'closed' | 'open' | 'half_open'

/** Host-projected breaker badge for one queue route. Memory-only on the host. */
export interface CircuitHealth {
  readonly provider: string
  readonly model: string
  readonly state: CircuitState
  readonly failures: number
}

/** Persisted failover document (settings namespace `dsh-failover-queue`). */
export interface FailoverSettings {
  /** When false, the plugin never overlays or retries across routes. */
  enabled: boolean
  /** Last picked queue index (P1 = 0). Clamped on read. Not a sticky pointer. */
  currentIndex: number
  /** Ordered routes. Index 0 is P1. */
  queue: QueueRoute[]
  /** Live circuit badges. Host memory is the source of truth. */
  circuits?: CircuitHealth[]
}

/** One advertised catalog row the panel can add. */
export interface FailoverCandidate {
  readonly provider: string
  readonly providerName: string
  readonly model: string
  readonly name: string
}

/** Marker the `/failover __candidates` handler prefixes onto JSON. */
export const CANDIDATES_MARKER = 'FAILOVER_CANDIDATES_V1'
