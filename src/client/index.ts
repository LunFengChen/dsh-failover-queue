/**
 * Browser half of dsh-failover-queue: a P1/P- chip on the composer tool row
 * and a Settings left-nav page. The chip still opens the drag-reorder popover.
 */
import type { Context } from '@deepseek-ai/cordis'
import { CANDIDATES_MARKER, type FailoverCandidate, type FailoverSettings } from '../types.ts'
import { FailoverChip, FailoverSettingsCard } from './FailoverChip.tsx'
import { en, NS, zh, type FailoverKey } from './locales.ts'
import { failoverSource, replaceCandidates, replaceSettings } from './state.ts'
import { STYLE } from './styles.ts'

/** Browser plugin context used here. Extra services are ignored. */
interface FailoverClientContext {
  effect(fn: () => (() => void) | void, name?: string): () => void
  locale: {
    register: (ns: string, packs: { zh: typeof zh; en: typeof en }) => () => void
    bind: (ns: string) => (key: FailoverKey, params?: Record<string, string | number>) => string
  }
  slots: {
    inject: (name: string, factory: () => () => void) => void
    register: (options: Record<string, unknown>, component: unknown) => () => void
  }
  settingsScope: {
    bind: (spec: { namespace: string }) => {
      getSnapshot: () => { value?: FailoverSettings; writable: boolean }
      set: (field: string, value: unknown) => Promise<void>
      subscribe: (cb: () => void) => () => void
    }
  }
  sessions?: {
    list: { getSnapshot: () => { current?: string } }
  }
  remote: {
    commands: {
      execute: (sessionId: string, line: string, attachments: unknown[]) => Promise<{
        ok: boolean
        value?: { text?: string } | string
        error?: { message: string; code: string }
      }>
    }
  }
}

/** Required services for the composer chip and settings page. */
export const inject = ['slots', 'locale', 'settingsScope', 'remote', 'remote.commands']

function settingsFromUnknown(value: unknown): FailoverSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as { enabled?: unknown; currentIndex?: unknown; queue?: unknown }
  if (typeof record.enabled !== 'boolean') return undefined
  if (typeof record.currentIndex !== 'number') return undefined
  if (!Array.isArray(record.queue)) return undefined
  const queue = record.queue.flatMap((row) => {
    if (typeof row !== 'object' || row === null) return []
    const item = row as { provider?: unknown; model?: unknown; label?: unknown }
    if (typeof item.provider !== 'string' || typeof item.model !== 'string') return []
    return [{
      provider: item.provider,
      model: item.model,
      ...typeof item.label === 'string' ? { label: item.label } : {},
    }]
  })
  return { enabled: record.enabled, currentIndex: record.currentIndex, queue }
}

function candidatesFromText(text: string): FailoverCandidate[] {
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
 * Register dictionaries, the composer chip, and the Settings left-nav page.
 * @param ctx - browser plugin context.
 */
export function apply(ctx: Context): void {
  const client = ctx as unknown as FailoverClientContext
  const scope = client.settingsScope.bind({ namespace: 'dsh-failover-queue' })

  const pull = (): void => {
    const value = settingsFromUnknown(scope.getSnapshot().value)
    if (value !== undefined) replaceSettings(value)
  }
  pull()

  const api = {
    setEnabled: async (enabled: boolean) => {
      await scope.set('enabled', enabled)
    },
    setQueue: async (queue: FailoverSettings['queue'], currentIndex: number) => {
      await scope.set('queue', queue)
      await scope.set('currentIndex', currentIndex)
    },
  }

  const loadCandidates = async (sessionId: string): Promise<void> => {
    if (sessionId === '') return
    const result = await client.remote.commands.execute(sessionId, '/failover __candidates', [])
    if (!result.ok) return
    const text = typeof result.value === 'string'
      ? result.value
      : typeof result.value?.text === 'string' ? result.value.text : ''
    if (text === '') return
    replaceCandidates(candidatesFromText(text))
  }

  const injected = (sessionId?: string) => ({
    hooks: { failover: failoverSource },
    api,
    loadCandidates,
    getSessionId: () => {
      if (typeof sessionId === 'string' && sessionId !== '') return sessionId
      return client.sessions?.list.getSnapshot().current ?? ''
    },
  })

  client.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-failover-queue'
    style.textContent = STYLE
    document.head.appendChild(style)
    return () => { style.remove() }
  }, 'dsh-failover-queue: styles')

  client.effect(() => client.locale.register(NS, { zh, en }), 'dsh-failover-queue: dictionaries')
  client.effect(() => scope.subscribe(pull), 'dsh-failover-queue: settings')

  client.slots.inject('conversation.input.right', () => client.slots.register({
    name: 'conversation.input.right',
    id: 'dsh-failover-queue',
    order: 40,
    locale: NS,
    inject: injected,
  }, FailoverChip))

  client.slots.inject('settings.section', () => client.slots.register({
    name: 'settings.section',
    id: 'failover',
    order: 17,
    locale: NS,
    label: () => client.locale.bind(NS)('settings.tab'),
    inject: injected,
  }, FailoverSettingsCard))
}
