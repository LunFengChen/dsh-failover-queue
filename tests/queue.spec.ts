import { describe, expect, it } from 'vitest'
import { parseFailoverArg } from '../src/command.ts'
import {
  advanceIndex,
  clampIndex,
  dedupeQueue,
  indexAfterReorder,
  reorderQueue,
  routeDisplay,
  routeKey,
  shouldFailoverImmediately,
} from '../src/queue.ts'

const a = { provider: 'huoshan', model: 'flash', label: '火山' }
const b = { provider: 'deepseek', model: 'deepseek-chat' }
const c = { provider: 'openrouter', model: 'deepseek/chat' }

describe('queue helpers', () => {
  it('clamps an index into the live queue', () => {
    expect(clampIndex(0, 0)).toBe(0)
    expect(clampIndex(-2, 3)).toBe(0)
    expect(clampIndex(9, 3)).toBe(2)
    expect(clampIndex(1.8, 3)).toBe(1)
  })

  it('reorders by moving one row and keeps the active route', () => {
    expect(reorderQueue([a, b, c], 0, 2)).toEqual([b, c, a])
    expect(indexAfterReorder(0, 0, 2)).toBe(2)
    expect(indexAfterReorder(2, 0, 2)).toBe(1)
    expect(indexAfterReorder(1, 2, 0)).toBe(2)
  })

  it('advances to the next uncooled route and wraps', () => {
    const cooled = new Set([routeKey(b)])
    expect(advanceIndex([a, b, c], 0, route => cooled.has(routeKey(route)))).toBe(2)
    expect(advanceIndex([a, b, c], 2, () => false)).toBe(0)
    expect(advanceIndex([a], 0, () => false)).toBeUndefined()
    expect(advanceIndex([a, b], 0, () => true)).toBeUndefined()
  })

  it('drops blank and duplicate routes', () => {
    expect(dedupeQueue([
      a,
      { provider: 'huoshan', model: 'flash' },
      { provider: '  ', model: 'x' },
      b,
    ])).toEqual([a, b])
  })

  it('trips immediately only on configured codes', () => {
    const codes = ['AUTH', 'RATE_LIMIT', 'NO_ADAPTER']
    expect(shouldFailoverImmediately('RATE_LIMIT', codes)).toBe(true)
    expect(shouldFailoverImmediately('TIMEOUT', codes)).toBe(false)
  })

  it('names a route from catalog titles, then the stored label', () => {
    expect(routeDisplay(b)).toEqual({ provider: 'deepseek', model: 'deepseek-chat' })
    expect(routeDisplay(a)).toEqual({ provider: 'huoshan', model: '火山' })
    expect(routeDisplay(b, [{
      provider: 'deepseek',
      providerName: 'DeepSeek',
      model: 'deepseek-chat',
      name: 'DeepSeek Chat',
    }])).toEqual({ provider: 'DeepSeek', model: 'DeepSeek Chat' })
  })
})

describe('parseFailoverArg', () => {
  it('accepts on/off/status/candidates', () => {
    expect(parseFailoverArg('')).toEqual({ kind: 'status' })
    expect(parseFailoverArg(' on ')).toEqual({ kind: 'on' })
    expect(parseFailoverArg('OFF')).toEqual({ kind: 'off' })
    expect(parseFailoverArg('__candidates')).toEqual({ kind: 'candidates' })
    expect(parseFailoverArg('nope').kind).toBe('error')
  })
})
