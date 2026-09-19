import { describe, expect, it } from 'vitest'
import {
  CircuitBank,
  CircuitBreaker,
  circuitTone,
  firstAvailableIndex,
  healthFor,
  pickFirstAvailable,
} from '../src/circuit.ts'
import { routeKey } from '../src/queue.ts'

const p1 = { provider: 'huoshan', model: 'flash' }
const p2 = { provider: 'deepseek', model: 'deepseek-chat' }
const p3 = { provider: 'openrouter', model: 'deepseek/chat' }
const knobs = { failureThreshold: 2, successThreshold: 2, timeoutMs: 60_000 }

describe('CircuitBreaker', () => {
  it('opens after the failure threshold and on the first immediate hit', () => {
    const ordinary = new CircuitBreaker(knobs)
    ordinary.recordFailure(1_000)
    expect(ordinary.snapshot().state).toBe('closed')
    ordinary.recordFailure(1_001)
    expect(ordinary.snapshot().state).toBe('open')

    const immediate = new CircuitBreaker(knobs)
    immediate.recordFailure(1_000, true)
    expect(immediate.snapshot().state).toBe('open')
  })

  it('turns Open into HalfOpen after the timeout, then Closed after two successes', () => {
    const breaker = new CircuitBreaker(knobs)
    breaker.recordFailure(1_000, true)
    expect(breaker.isAvailable(1_000 + 59_999)).toBe(false)
    expect(breaker.isAvailable(1_000 + 60_000)).toBe(true)
    expect(breaker.snapshot().state).toBe('half_open')

    const first = breaker.allowProbe(1_000 + 60_000)
    expect(first).toEqual({ allowed: true, halfOpen: true })
    expect(breaker.allowProbe(1_000 + 60_000)).toEqual({ allowed: false, halfOpen: true })

    breaker.recordSuccess()
    expect(breaker.snapshot().state).toBe('half_open')
    breaker.allowProbe(1_000 + 60_001)
    breaker.recordSuccess()
    expect(breaker.snapshot().state).toBe('closed')
    expect(breaker.snapshot().failures).toBe(0)
  })

  it('reopens when a HalfOpen probe fails', () => {
    const breaker = new CircuitBreaker(knobs)
    breaker.recordFailure(1_000, true)
    expect(breaker.isAvailable(61_000)).toBe(true)
    breaker.allowProbe(61_000)
    breaker.recordFailure(61_001)
    expect(breaker.snapshot().state).toBe('open')
    expect(breaker.isAvailable(61_001)).toBe(false)
  })
})

describe('pickFirstAvailable', () => {
  it('returns P1 once P1 is HalfOpen even if the last used slot was P2', () => {
    const bank = new CircuitBank(knobs)
    const queue = [p1, p2, p3]
    bank.get(routeKey(p1)).recordFailure(1_000, true)
    expect(pickFirstAvailable(queue, bank, 1_000)?.route).toEqual(p2)
    expect(firstAvailableIndex(queue, bank, 1_000)).toBe(1)

    const recovered = pickFirstAvailable(queue, bank, 1_000 + 60_000)
    expect(recovered).toMatchObject({ index: 0, route: p1, halfOpen: true })
  })

  it('skips the route that just failed so the same tick does not probe it again', () => {
    const bank = new CircuitBank({ ...knobs, timeoutMs: 0 })
    const queue = [p1, p2]
    bank.get(routeKey(p1)).recordFailure(5_000, true)
    expect(firstAvailableIndex(queue, bank, 5_000, routeKey(p1))).toBe(1)
    expect(pickFirstAvailable(queue, bank, 5_000, routeKey(p1))?.route).toEqual(p2)
  })
})

describe('circuitTone', () => {
  it('is green when closed, yellow while counting or probing, red when open', () => {
    expect(circuitTone(undefined)).toBe('ok')
    expect(circuitTone({ provider: 'a', model: 'b', state: 'closed', failures: 0 })).toBe('ok')
    expect(circuitTone({ provider: 'a', model: 'b', state: 'closed', failures: 1 })).toBe('probe')
    expect(circuitTone({ provider: 'a', model: 'b', state: 'half_open', failures: 2 })).toBe('probe')
    expect(circuitTone({ provider: 'a', model: 'b', state: 'open', failures: 2 })).toBe('open')
  })

  it('matches health rows by provider and model', () => {
    expect(healthFor(p2, [
      { provider: p1.provider, model: p1.model, state: 'open', failures: 1 },
      { provider: p2.provider, model: p2.model, state: 'closed', failures: 0 },
    ])).toEqual({ provider: p2.provider, model: p2.model, state: 'closed', failures: 0 })
  })
})
