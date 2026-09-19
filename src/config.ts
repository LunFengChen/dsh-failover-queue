import z from '@deepseek-ai/schemastery'
import type { CircuitHealth, FailoverSettings, QueueRoute } from './types.ts'

/** Plugin config accepted from cordis.yml / the bundle patch. */
export interface Config {
  /** Milliseconds an Open circuit waits before a HalfOpen probe. Default 60000. */
  cooldownMs?: number
  /** Consecutive failures that open a Closed breaker. Default 2. */
  failureThreshold?: number
  /** Consecutive HalfOpen successes that close the breaker. Default 2. */
  successThreshold?: number
  /**
   * Failure codes that skip remaining same-route retries, open the circuit
   * immediately, and jump to the next P. Default `AUTH`, `RATE_LIMIT`, `NO_ADAPTER`.
   */
  immediateCodes?: string[]
}

/** Config after schema defaults. */
export interface ResolvedConfig {
  cooldownMs: number
  failureThreshold: number
  successThreshold: number
  immediateCodes: readonly string[]
}

/** Runtime schema. */
export const Config: z<Config> = z.object({
  cooldownMs: z.number().min(0).default(60_000),
  failureThreshold: z.number().min(1).default(2),
  successThreshold: z.number().min(1).default(2),
  immediateCodes: z.array(z.string()).default(['AUTH', 'RATE_LIMIT', 'NO_ADAPTER']),
})

/**
 * Apply schema defaults.
 * @param config - raw plugin config, possibly partial.
 */
export function resolveConfig(config: Config = {}): ResolvedConfig {
  return Config(config) as ResolvedConfig
}

/** Settings namespace (hyphenated; settings forbids dots). */
export const SETTINGS_NAMESPACE = 'dsh-failover-queue'

const QueueRouteSchema: z<QueueRoute> = z.object({
  provider: z.string(),
  model: z.string(),
  label: z.string().default(''),
})

const CircuitHealthSchema: z<CircuitHealth> = z.object({
  provider: z.string(),
  model: z.string(),
  state: z.string().default('closed'),
  failures: z.number().min(0).default(0),
})

/** Persisted user document. */
export const FailoverSettingsSchema: z<FailoverSettings> = z.object({
  enabled: z.boolean().default(false),
  currentIndex: z.number().step(1).min(0).default(0),
  queue: z.array(QueueRouteSchema).default([]),
  circuits: z.array(CircuitHealthSchema).default([]),
})

/** Empty queue, failover off. */
export const DEFAULT_SETTINGS: FailoverSettings = {
  enabled: false,
  currentIndex: 0,
  queue: [],
  circuits: [],
}
