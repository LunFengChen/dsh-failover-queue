import z from '@deepseek-ai/schemastery'
import type { FailoverSettings, QueueRoute } from './types.ts'

/** Plugin config accepted from cordis.yml / the bundle patch. */
export interface Config {
  /** Milliseconds a failed route stays skipped. Default 60000. */
  cooldownMs?: number
  /**
   * Failure codes that skip remaining same-route retries and jump to the
   * next P immediately. Default `AUTH`, `RATE_LIMIT`, `NO_ADAPTER`.
   */
  immediateCodes?: string[]
}

/** Config after schema defaults. */
export interface ResolvedConfig {
  cooldownMs: number
  immediateCodes: readonly string[]
}

/** Runtime schema. */
export const Config: z<Config> = z.object({
  cooldownMs: z.number().min(0).default(60_000),
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

/** Persisted user document. */
export const FailoverSettingsSchema: z<FailoverSettings> = z.object({
  enabled: z.boolean().default(false),
  currentIndex: z.number().step(1).min(0).default(0),
  queue: z.array(QueueRouteSchema).default([]),
})

/** Empty queue, failover off. */
export const DEFAULT_SETTINGS: FailoverSettings = {
  enabled: false,
  currentIndex: 0,
  queue: [],
}
