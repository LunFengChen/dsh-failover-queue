export const COMPOSER_PANEL_MARGIN = 8
export const COMPOSER_PANEL_GAP = 8
export const COMPOSER_PANEL_MAX_HEIGHT = 420

export interface BoxEdge {
  top: number
  right: number
  bottom: number
}

export interface ComposerPanelPlacement {
  left: number
  top: number
  maxHeight: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Cap the composer popover so it can sit inside the viewport with 8px gutters.
 * @param viewportHeight - `window.innerHeight`.
 * @returns CSS max-height in pixels.
 */
export function composerPanelMaxHeight(viewportHeight: number): number {
  return Math.min(
    COMPOSER_PANEL_MAX_HEIGHT,
    Math.max(0, viewportHeight - COMPOSER_PANEL_MARGIN * 2),
  )
}

/**
 * Prefer above the chip; go below only when the full panel fits; otherwise clamp.
 * @param input - trigger box, measured size, and viewport.
 * @returns fixed `left`/`top` plus the height cap to apply.
 */
export function placeComposerPanel(input: {
  trigger: BoxEdge
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
}): ComposerPanelPlacement {
  const maxHeight = composerPanelMaxHeight(input.viewportHeight)
  const height = Math.min(Math.max(0, input.height), maxHeight)
  const maxWidth = Math.max(0, input.viewportWidth - COMPOSER_PANEL_MARGIN * 2)
  const width = Math.min(Math.max(0, input.width), maxWidth)
  const left = clamp(
    input.trigger.right - width,
    COMPOSER_PANEL_MARGIN,
    Math.max(COMPOSER_PANEL_MARGIN, input.viewportWidth - width - COMPOSER_PANEL_MARGIN),
  )
  const minTop = COMPOSER_PANEL_MARGIN
  const maxTop = Math.max(minTop, input.viewportHeight - height - COMPOSER_PANEL_MARGIN)
  const above = input.trigger.top - COMPOSER_PANEL_GAP - height
  const below = input.trigger.bottom + COMPOSER_PANEL_GAP
  let top: number
  if (above >= minTop) {
    top = above
  } else if (below + height <= input.viewportHeight - COMPOSER_PANEL_MARGIN) {
    top = below
  } else {
    top = clamp(above, minTop, maxTop)
  }
  return { left, top, maxHeight }
}
