import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as failover from '../src/index.ts'
import { DEFAULT_SETTINGS, SETTINGS_NAMESPACE } from '../src/config.ts'
import type { FailoverSettings } from '../src/types.ts'

interface LlmCall {
  provider: string
  model: string
}

function boot(settings: FailoverSettings = DEFAULT_SETTINGS) {
  const ctx = new Context()
  const store = { value: { ...settings, queue: [...settings.queue] } }
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
  return { ctx, store }
}

describe('failover apply', () => {
  it('overlays the active P route on agent/request when enabled', async () => {
    const { ctx } = boot({
      enabled: true,
      currentIndex: 1,
      queue: [
        { provider: 'huoshan', model: 'flash' },
        { provider: 'deepseek', model: 'deepseek-chat' },
      ],
    })
    await ctx.plugin(failover)
    const result = await (ctx as Context & {
      waterfall: (name: string, payload: unknown, next: () => Promise<LlmCall>) => Promise<LlmCall>
    }).waterfall('agent/request', { agent: {} }, async () => ({
      provider: 'session',
      model: 'picked',
    }))
    expect(result).toMatchObject({ provider: 'deepseek', model: 'deepseek-chat' })
  })

  it('retries onto the next P after a RATE_LIMIT without waiting on llm-retry', async () => {
    const { ctx, store } = boot({
      enabled: true,
      currentIndex: 0,
      queue: [
        { provider: 'huoshan', model: 'flash' },
        { provider: 'deepseek', model: 'deepseek-chat' },
      ],
    })
    await ctx.plugin(failover)
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
  })

  it('exposes the settings namespace used by the composer chip', () => {
    expect(SETTINGS_NAMESPACE).toBe('dsh-failover-queue')
  })
})
