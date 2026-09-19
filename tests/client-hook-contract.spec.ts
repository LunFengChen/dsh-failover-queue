import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const chip = readFileSync(new URL('../src/client/FailoverChip.tsx', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/client/QueuePanel.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('../src/client/index.ts', import.meta.url), 'utf8')

describe('client slot hook contract', () => {
  it('reads failover state through a selector, matching the slot renderer', () => {
    expect(chip).toContain('useFailover(snapshot => snapshot)')
    expect(chip.match(/useFailover\(\s*\)/)).toBeNull()
  })

  it('does not touch ctx.sessions without inject', () => {
    expect(client).not.toMatch(/client\.sessions/)
    expect(client).toContain("ctx.get('sessions')")
  })

  it('opens a portaled route menu instead of a native select', () => {
    expect(panel).not.toContain('<select')
    expect(panel).toContain('createPortal')
    expect(panel).toContain('CLASS.menu')
    expect(panel).toContain('selectedProvider')
    expect(panel).toContain('groupCandidatesByProvider')
  })

  it('shows a circuit-health dot on each queue row', () => {
    expect(panel).toContain('CLASS.health')
    expect(panel).toContain('circuitTone')
    expect(panel).toContain('panel.health.ok')
  })

  it('keeps the composer popover inside the viewport', () => {
    expect(chip).toContain('placeComposerPanel')
    expect(chip).toContain("addEventListener('scroll', place, true)")
    expect(chip).toContain('zIndex: 2000')
    expect(chip).toContain("overflow: 'auto'")
    expect(chip).toContain("closest('.dsh-fq-menu')")
  })

  it('ships the same contracts in the browser bundle', () => {
    const built = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    expect(built).toContain('useFailover((snapshot')
    expect(built).not.toMatch(/client\.sessions/)
    expect(built).toContain('get("sessions")')
    expect(built).toContain('modelCatalog')
    expect(built).toContain('createPortal')
    expect(built).not.toContain('<select')
  })
})
