import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as failover from '../src/index.ts'
import { DEFAULT_SETTINGS, SETTINGS_NAMESPACE } from '../src/config.ts'
import type { FailoverSettings } from '../src/types.ts'

interface LlmCall {
  provider: string
  model: string
}

function boot(settings: FailoverSettings = DEFAULT_SETTINGS, config: failover.ConfigInput = {}) {
  const ctx = new Context()
  const store = { value: { ...settings, queue: [...settings.queue], circuits: [...(settings.circuits ?? [])] } }
  const llm = {
    listProviders: () => [{ id: 'deepseek', name: 'DeepSeek' }],
    listModels: async () => [{ provider: 'deepseek', id: 'deepseek-chat', name: 'DeepSeek Chat' }],
  }
  ctx.provide('llm', llm)
  ;(ctx as Context & { llm: typeof llm }).llm = llm
  ctx.provide('settings', {
    register: (_ns: string, _schema: unknown, options: { base: FailoverSettings }) => {
      store.value = { ...options.base, ...store.value }
      return {
        get: () => store.value,
        update: async (patch: Partial<FailoverSettings>) => {
          store.value = { ...store.value, ...patch }
        },
      }
    },
  })
  return { ctx, store, config }
}

async function mount(settings: FailoverSettings, config: failover.ConfigInput = {}) {
  const { ctx, store } = boot(settings, config)
  await ctx.plugin(failover, config)
  return { ctx, store }
}

describe('failover apply', () => {
  it('overlays P1 even when the saved currentIndex is P2', async () => {
    const { ctx } = await mount({
      enabled: true,
      currentIndex: 1,
      queue: [
        { provider: 'huoshan', model: 'flash' },
        { provider: 'deepseek', model: 'deepseek-chat' },
      ],
    })
    const result = await (ctx as Context & {
      waterfall: (name: string, payload: unknown, next: () => Promise<LlmCall>) => Promise<LlmCall>
    }).waterfall('agent/request', { agent: {} }, async () => ({
      provider: 'session',
      model: 'picked',
    }))
    expect(result).toMatchObject({ provider: 'huoshan', model: 'flash' })
  })

  it('retries onto the next P after a RATE_LIMIT without waiting on llm-retry', async () => {
    const { ctx, store } = await mount({
      enabled: true,
      currentIndex: 0,
      queue: [
        { provider: 'huoshan', model: 'flash' },
        { provider: 'deepseek', model: 'deepseek-chat' },
      ],
    })
    const downstream: string[] = []
    const result = await (ctx as Context & {
      waterfall: (
        name: string,
        payload: unknown,
        next: () => Promise<{ kind: 'retry' } | undefined>,
      ) => Promise<{ kind: 'retry' } | undefined>
    }).waterfall(
      'agent/request-error',
      { failure: { code: 'RATE_LIMIT' }, provider: 'huoshan' },
      async () => {
        downstream.push('next')
        return { kind: 'retry' as const }
      },
    )
    expect(downstream).toEqual([])
    expect(result).toEqual({ kind: 'retry' })
    expect(store.value.currentIndex).toBe(1)
    expect(store.value.circuits?.[0]).toMatchObject({
      provider: 'huoshan',
      model: 'flash',
      state: 'open',
    })
  })

  it('keeps overlaying P2 until P1\'s open window elapses', async () => {
    const { ctx } = await mount({
      enabled: true,
      currentIndex: 0,
      queue: [
        { provider: 'huoshan', model: 'flash' },
        { provider: 'deepseek', model: 'deepseek-chat' },
      ],
    })
    const waterfall = (ctx as Context & {
      waterfall: (name: string, payload: unknown, next: () => Promise<unknown>) => Promise<unknown>
    }).waterfall
    await waterfall(
      'agent/request-error',
      { failure: { code: 'RATE_LIMIT' }, provider: 'huoshan' },
      async () => ({ kind: 'retry' as const }),
    )
    const result = await waterfall('agent/request', { agent: {} }, async () => ({
      provider: 'session',
      model: 'picked',
    }))
    expect(result).toMatchObject({ provider: 'deepseek', model: 'deepseek-chat' })
  })

  it('probes P1 again on the next request when the open window is zero', async () => {
    const { ctx } = await mount({
      enabled: true,
      currentIndex: 0,
      queue: [
        { provider: 'huoshan', model: 'flash' },
        { provider: 'deepseek', model: 'deepseek-chat' },
      ],
    }, { cooldownMs: 0 })
    const waterfall = (ctx as Context & {
      waterfall: (name: string, payload: unknown, next: () => Promise<unknown>) => Promise<unknown>
    }).waterfall
    await waterfall(
      'agent/request-error',
      { failure: { code: 'AUTH' }, provider: 'huoshan' },
      async () => ({ kind: 'retry' as const }),
    )
    const result = await waterfall('agent/request', { agent: {} }, async () => ({
      provider: 'session',
      model: 'picked',
    }))
    expect(result).toMatchObject({ provider: 'huoshan', model: 'flash' })
  })

  it('records a completed assistant/message as a probe success', async () => {
    const { ctx, store } = await mount({
      enabled: true,
      currentIndex: 0,
      queue: [
        { provider: 'huoshan', model: 'flash' },
        { provider: 'deepseek', model: 'deepseek-chat' },
      ],
    }, { cooldownMs: 0, successThreshold: 1 })
    const waterfall = (ctx as Context & {
      waterfall: (name: string, payload: unknown, next: () => Promise<unknown>) => Promise<unknown>
    }).waterfall
    await waterfall(
      'agent/request-error',
      { failure: { code: 'AUTH' }, provider: 'huoshan' },
      async () => undefined,
    )
    await waterfall('agent/request', { agent: { id: 'a1' } }, async () => ({
      provider: 'session',
      model: 'picked',
    }))
    ctx.emit('agent/assistant-stream', {
      agent: { id: 'a1' },
      frame: {
        type: 'end',
        outcome: { kind: 'committed', eventType: 'assistant/message' },
      },
    })
    expect(store.value.circuits?.[0]).toMatchObject({
      provider: 'huoshan',
      model: 'flash',
      state: 'closed',
    })
  })

  it('exposes the settings namespace used by the composer chip', () => {
    expect(SETTINGS_NAMESPACE).toBe('dsh-failover-queue')
  })
})
