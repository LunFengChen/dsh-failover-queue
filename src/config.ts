import z from '@deepseek-ai/schemastery'
import type { CircuitHealth, FailoverSettings, QueueRoute } from './types.ts'

function live<T>(schema: z<T>): z<T> {
  return (schema as z<T> & { extra(key: string, value: boolean): z<T> }).extra('volatile', true)
}

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
   * immediately, and jump to the next P. Default includes 5xx / timeout /
   * transport so a backup P is used instead of waiting out `llm-retry`.
   */
  immediateCodes?: string[]
  enabled?: boolean
  currentIndex?: number
  queue?: QueueRoute[]
  circuits?: CircuitHealth[]
}

/** Config after schema defaults. */
export interface ResolvedConfig {
  cooldownMs: number
  failureThreshold: number
  successThreshold: number
  immediateCodes: readonly string[]
}

/**
 * Codes that mean this route cannot serve the request now.
 * `EMPTY_RESPONSE` stays on same-route `llm-retry`.
 */
export const DEFAULT_IMMEDIATE_CODES = [
  'AUTH',
  'RATE_LIMIT',
  'NO_ADAPTER',
  'SERVER',
  'TIMEOUT',
  'TRANSPORT',
] as const

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

/** Empty queue, failover off. */
export const DEFAULT_SETTINGS: FailoverSettings = {
  enabled: false,
  currentIndex: 0,
  queue: [],
  circuits: [],
}

const TunableConfig: z<Pick<Config, 'cooldownMs' | 'failureThreshold' | 'successThreshold' | 'immediateCodes'>> = z.object({
  cooldownMs: z.number().min(0).default(60_000),
  failureThreshold: z.number().min(1).default(2),
  successThreshold: z.number().min(1).default(2),
  immediateCodes: z.array(z.string()).default([...DEFAULT_IMMEDIATE_CODES]),
})

/** Persisted user document. */
export const FailoverSettingsSchema: z<FailoverSettings> = z.object({
  enabled: live(z.boolean().default(false)),
  currentIndex: live(z.number().step(1).min(0).default(0)),
  queue: live(z.array(QueueRouteSchema).default([])),
  circuits: live(z.array(CircuitHealthSchema).default([])),
})

/** Runtime schema. */
export const Config: z<Config> = z.object({
  cooldownMs: z.number().min(0).default(60_000),
  failureThreshold: z.number().min(1).default(2),
  successThreshold: z.number().min(1).default(2),
  immediateCodes: z.array(z.string()).default([...DEFAULT_IMMEDIATE_CODES]),
  enabled: live(z.boolean().default(false)),
  currentIndex: live(z.number().step(1).min(0).default(0)),
  queue: live(z.array(QueueRouteSchema).default([])),
  circuits: live(z.array(CircuitHealthSchema).default([])),
})

/**
 * Apply schema defaults.
 * @param config - raw plugin config, possibly partial.
 */
export function resolveConfig(config: Config = {}): ResolvedConfig {
  return TunableConfig({
    cooldownMs: config.cooldownMs,
    failureThreshold: config.failureThreshold,
    successThreshold: config.successThreshold,
    immediateCodes: config.immediateCodes,
  }) as ResolvedConfig
}

/** Settings namespace (hyphenated; settings forbids dots). */
export const SETTINGS_NAMESPACE = 'dsh-failover-queue'
