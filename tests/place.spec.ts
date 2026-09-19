import { describe, expect, it } from 'vitest'
import { composerPanelMaxHeight, placeComposerPanel } from '../src/client/place.ts'

describe('placeComposerPanel', () => {
  it('sits fully above a bottom chip when there is room', () => {
    const placed = placeComposerPanel({
      trigger: { top: 850, right: 900, bottom: 872 },
      width: 320,
      height: 420,
      viewportWidth: 1280,
      viewportHeight: 900,
    })
    expect(placed.maxHeight).toBe(420)
    expect(placed.top).toBe(850 - 8 - 420)
    expect(placed.top + 420).toBeLessThanOrEqual(900 - 8)
    expect(placed.left + 320).toBeLessThanOrEqual(1280 - 8)
  })

  it('opens below a top chip when above would clip', () => {
    const placed = placeComposerPanel({
      trigger: { top: 40, right: 400, bottom: 62 },
      width: 320,
      height: 200,
      viewportWidth: 800,
      viewportHeight: 600,
    })
    expect(placed.top).toBe(70)
    expect(placed.top + 200).toBeLessThanOrEqual(600 - 8)
  })

  it('clamps a taller-than-viewport panel into the window', () => {
    const placed = placeComposerPanel({
      trigger: { top: 100, right: 700, bottom: 122 },
      width: 320,
      height: 900,
      viewportWidth: 800,
      viewportHeight: 540,
    })
    expect(placed.maxHeight).toBe(420)
    expect(placed.top).toBe(8)
    expect(placed.top + placed.maxHeight).toBeLessThanOrEqual(540 - 8)
  })

  it('never uses a negative top when the measured height exceeds the viewport', () => {
    const placed = placeComposerPanel({
      trigger: { top: 370, right: 640, bottom: 392 },
      width: 320,
      height: 800,
      viewportWidth: 640,
      viewportHeight: 400,
    })
    expect(placed.maxHeight).toBe(384)
    expect(placed.top).toBe(8)
    expect(placed.top + placed.maxHeight).toBeLessThanOrEqual(400 - 8)
  })
})

describe('composerPanelMaxHeight', () => {
  it('caps at 420 unless the viewport is shorter', () => {
    expect(composerPanelMaxHeight(900)).toBe(420)
    expect(composerPanelMaxHeight(400)).toBe(384)
  })
})
