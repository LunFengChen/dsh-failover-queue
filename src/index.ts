/**
 * dsh-failover-queue: CC Switch-style P1/P2/P3 failover.
 *
 * Overlay `agent/request` with the active queue route. On `agent/request-error`,
 * let `llm-retry` finish same-route recovery first, then advance to the next
 * P and return `{ kind: 'retry' }`. AUTH / RATE_LIMIT / NO_ADAPTER skip that
 * wait. Composer chip and `/failover` read the same settings document.
 *
 * @module @x1a0f3n9/dsh-failover-queue
 */

import type { Context } from '@deepseek-ai/cordis'
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
  advanceIndex,
  clampIndex,
  dedupeQueue,
  routeKey,
  shouldFailoverImmediately,
} from './queue.ts'
import { CANDIDATES_MARKER, type FailoverCandidate, type FailoverSettings, type QueueRoute } from './types.ts'

export const name = 'dsh-failover-queue'
export const inject = ['llm']
export { Config, resolveConfig, SETTINGS_NAMESPACE }
export type { Config as ConfigInput, ResolvedConfig }
export type { FailoverCandidate, FailoverSettings, QueueRoute } from './types.ts'
export {
  advanceIndex,
  clampIndex,
  dedupeQueue,
  indexAfterReorder,
  reorderQueue,
  routeKey,
} from './queue.ts'
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

/**
 * Mount settings, `/failover`, and the request overlay.
 * @param ctx - plugin context; requires `llm`.
 * @param config - raw plugin config.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const resolved = resolveConfig(config)
  const cooledUntil = new Map<string, number>()
  let liveIndex: number | undefined
  let settings: SettingsScope | undefined

  const read = (): FailoverSettings => {
    const raw = settings?.get() ?? DEFAULT_SETTINGS
    const queue = dedupeQueue(raw.queue)
    return {
      enabled: raw.enabled,
      queue,
      currentIndex: clampIndex(liveIndex ?? raw.currentIndex, queue.length),
    }
  }

  const writeIndex = (index: number): void => {
    liveIndex = index
    void settings?.update({ currentIndex: index })
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

  ctx.on('agent/request', async (_payload: unknown, next: () => Promise<LlmCallConfig>) => {
    const call = await next()
    const state = read()
    if (!state.enabled || state.queue.length === 0) return call
    const route = state.queue[state.currentIndex]
    if (route === undefined) return call
    return { ...call, provider: route.provider, model: route.model }
  })

  ctx.on(
    'agent/request-error',
    async (
      payload: { failure: { code: string }; provider: string },
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

      if (!state.enabled || state.queue.length < 2) return downstream

      const now = Date.now()
      const failed = state.queue[state.currentIndex]
      if (failed !== undefined) {
        cooledUntil.set(routeKey(failed), now + resolved.cooldownMs)
      }

      const nextIndex = advanceIndex(
        state.queue,
        state.currentIndex,
        route => (cooledUntil.get(routeKey(route)) ?? 0) > now,
      )
      if (nextIndex === undefined) return downstream
      writeIndex(nextIndex)
      return { kind: 'retry' }
    },
  )
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
        ? 'Failover on. Requests use P1, then P2, then P3 on failure.'
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
    return `${mark} P${index + 1}  ${label}  (${route.provider} ${route.model})`
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
