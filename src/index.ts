/**
 * dsh-failover-queue: CC Switch-style P1/P2/P3 failover.
 *
 * Overlay `agent/request` with the first available queue route (P1 preferred).
 * On `agent/request-error`, open that route's circuit and retry the next
 * available P. AUTH / RATE_LIMIT / NO_ADAPTER skip `llm-retry` and open on
 * the first hit. After `cooldownMs`, P1 becomes HalfOpen and the next request
 * probes it — failback is not sticky. Composer chip and `/failover` read the
 * same settings document.
 *
 * @module @x1a0f3n9/dsh-failover-queue
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  CircuitBank,
  firstAvailableIndex,
  pickFirstAvailable,
} from './circuit.ts'
import { parseFailoverArg } from './command.ts'
import {
  Config,
  DEFAULT_SETTINGS,
  FailoverSettingsSchema,
  resolveConfig,
  SETTINGS_NAMESPACE,
  type ResolvedConfig,
} from './config.ts'
import {
  clampIndex,
  dedupeQueue,
  routeKey,
  shouldFailoverImmediately,
} from './queue.ts'
import { CANDIDATES_MARKER, type FailoverCandidate, type FailoverSettings } from './types.ts'

export const name = 'dsh-failover-queue'
export const inject = ['llm']
export { Config, resolveConfig, SETTINGS_NAMESPACE }
export type { Config as ConfigInput, ResolvedConfig }
export type { CircuitHealth, CircuitState, FailoverCandidate, FailoverSettings, QueueRoute } from './types.ts'
export {
  advanceIndex,
  clampIndex,
  dedupeQueue,
  indexAfterReorder,
  reorderQueue,
  routeDisplay,
  routeKey,
} from './queue.ts'
export {
  CircuitBank,
  CircuitBreaker,
  circuitTone,
  firstAvailableIndex,
  healthFor,
  pickFirstAvailable,
} from './circuit.ts'
export { parseFailoverArg } from './command.ts'

interface LlmCallConfig {
  provider: string
  model: string
  [key: string]: unknown
}

interface RequestErrorAction {
  kind: 'retry'
}

interface SettingsScope {
  get(): FailoverSettings
  update(patch: Partial<FailoverSettings>): Promise<void>
}

interface CommandInvocation {
  readonly rawInput: string
}

interface LlmService {
  listProviders(): Array<{ id: string; name: string }>
  listModels(provider: string): Promise<Array<{ provider: string; id: string; name: string }>>
}

interface Flight {
  readonly key: string
  readonly halfOpen: boolean
}

/**
 * Mount settings, `/failover`, and the request overlay.
 * @param ctx - plugin context; requires `llm`.
 * @param config - raw plugin config.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const resolved = resolveConfig(config)
  const bank = new CircuitBank({
    failureThreshold: resolved.failureThreshold,
    successThreshold: resolved.successThreshold,
    timeoutMs: resolved.cooldownMs,
  })
  const flights = new Map<string, Flight>()
  let liveIndex: number | undefined
  let settings: SettingsScope | undefined

  const read = (): FailoverSettings => {
    const raw = settings?.get() ?? DEFAULT_SETTINGS
    const queue = dedupeQueue(raw.queue)
    return {
      enabled: raw.enabled,
      queue,
      currentIndex: clampIndex(liveIndex ?? raw.currentIndex, queue.length),
      circuits: bank.health(queue, Date.now()),
    }
  }

  const publish = (index?: number): void => {
    if (index !== undefined) liveIndex = index
    const state = read()
    void settings?.update({
      currentIndex: state.currentIndex,
      circuits: state.circuits,
    })
  }

  ctx.inject(['settings'], (scoped) => {
    const holder = scoped as Context & {
      settings: {
        register: (
          ns: string,
          schema: unknown,
          options: { base: FailoverSettings },
        ) => SettingsScope
      }
    }
    settings = holder.settings.register(SETTINGS_NAMESPACE, FailoverSettingsSchema, {
      base: DEFAULT_SETTINGS,
    })
    publish()
    return () => {
      settings = undefined
    }
  })

  ctx.inject(['commands'], (scoped) => {
    const holder = scoped as Context & {
      commands: {
        register: (definition: {
          name: string
          description: string
          input: { hint: string }
          handler: (invocation: CommandInvocation) => Promise<{ kind: 'success' | 'error'; text: string }>
        }) => () => void
      }
    }
    const dispose = holder.commands.register({
      name: 'failover',
      description: 'Turn P1/P2/P3 failover on or off, or print the queue',
      input: { hint: '[on|off|status]' },
      handler: invocation => handleFailoverCommand(ctx, read, settings, invocation.rawInput),
    })
    return () => {
      dispose()
    }
  })

  ctx.on('agent/request', async (payload: unknown, next: () => Promise<LlmCallConfig>) => {
    const call = await next()
    const state = read()
    if (!state.enabled || state.queue.length === 0) return call
    const now = Date.now()
    const pick = pickFirstAvailable(state.queue, bank, now)
    if (pick === undefined) return call
    flights.set(agentKey(payload), { key: routeKey(pick.route), halfOpen: pick.halfOpen })
    publish(pick.index)
    return { ...call, provider: pick.route.provider, model: pick.route.model }
  })

  ctx.on(
    'agent/request-error',
    async (
      payload: { failure: { code: string }; provider: string; agent?: { id?: string } },
      next: () => Promise<RequestErrorAction | undefined>,
    ) => {
      const state = read()
      const immediate = state.enabled
        && shouldFailoverImmediately(payload.failure.code, resolved.immediateCodes)

      let downstream: RequestErrorAction | undefined
      if (!immediate) {
        downstream = await next()
        if (downstream?.kind === 'retry') return downstream
      }

      if (!state.enabled || state.queue.length === 0) return downstream

      const now = Date.now()
      const id = agentKey(payload)
      const flight = flights.get(id)
      const failedKey = flight?.key ?? routeKeyFromIndex(state)
      if (failedKey !== undefined) {
        bank.get(failedKey).recordFailure(now, immediate)
        flights.delete(id)
      }

      if (state.queue.length < 2) {
        publish()
        return downstream
      }

      const nextIndex = firstAvailableIndex(state.queue, bank, now, failedKey)
      if (nextIndex === undefined) {
        publish()
        return downstream
      }
      publish(nextIndex)
      return { kind: 'retry' }
    },
    { prepend: true },
  )

  ctx.on('agent/assistant-stream', (payload: {
    agent?: { id?: string }
    frame?: {
      type?: string
      outcome?: { kind?: string; eventType?: string }
    }
  }) => {
    if (payload.frame?.type !== 'end') return
    if (payload.frame.outcome?.kind !== 'committed') return
    if (payload.frame.outcome.eventType !== 'assistant/message') return
    const id = agentKey(payload)
    const flight = flights.get(id)
    if (flight === undefined) return
    flights.delete(id)
    bank.get(flight.key).recordSuccess()
    publish()
  })
}

function routeKeyFromIndex(state: FailoverSettings): string | undefined {
  const route = state.queue[state.currentIndex]
  return route === undefined ? undefined : routeKey(route)
}

function agentKey(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return 'default'
  const agent = (payload as { agent?: { id?: unknown } }).agent
  return typeof agent?.id === 'string' && agent.id !== '' ? agent.id : 'default'
}

async function handleFailoverCommand(
  ctx: Context,
  read: () => FailoverSettings,
  settings: SettingsScope | undefined,
  rawInput: string,
): Promise<{ kind: 'success' | 'error'; text: string }> {
  const verb = parseFailoverArg(rawInput)
  if (verb.kind === 'error') return { kind: 'error', text: verb.text }
  if (verb.kind === 'candidates') {
    const candidates = await listCandidates(ctx)
    return { kind: 'success', text: `${CANDIDATES_MARKER}\n${JSON.stringify(candidates)}` }
  }
  if (verb.kind === 'on' || verb.kind === 'off') {
    if (settings === undefined) {
      return { kind: 'error', text: 'Failover settings are not available yet.' }
    }
    await settings.update({ enabled: verb.kind === 'on' })
    return {
      kind: 'success',
      text: verb.kind === 'on'
        ? 'Failover on. Requests prefer P1; P2/P3 are backups. Recovered P1 is probed and selected again.'
        : 'Failover off. The session model is used as-is.',
    }
  }
  const state = read()
  if (state.queue.length === 0) {
    return {
      kind: 'success',
      text: state.enabled
        ? 'Failover is on, but the queue is empty. Open the P chip on the composer to add routes.'
        : 'Failover is off. Queue is empty.',
    }
  }
  const lines = state.queue.map((route, index) => {
    const mark = index === state.currentIndex ? '*' : ' '
    const label = route.label?.trim() || `${route.provider}/${route.model}`
    const health = state.circuits?.find(row => row.provider === route.provider && row.model === route.model)
    const badge = health === undefined || health.state === 'closed'
      ? ''
      : `  [${health.state}]`
    return `${mark} P${index + 1}  ${label}  (${route.provider} ${route.model})${badge}`
  })
  return {
    kind: 'success',
    text: `${state.enabled ? 'Failover on' : 'Failover off'}\n${lines.join('\n')}`,
  }
}

async function listCandidates(ctx: Context): Promise<FailoverCandidate[]> {
  const llm = (ctx as Context & { llm?: LlmService }).llm
  if (llm === undefined) return []
  const out: FailoverCandidate[] = []
  for (const provider of llm.listProviders()) {
    const models = await llm.listModels(provider.id)
    for (const model of models) {
      out.push({
        provider: provider.id,
        providerName: provider.name,
        model: model.id,
        name: model.name,
      })
    }
  }
  return out
}
