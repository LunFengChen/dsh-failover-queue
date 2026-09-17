import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { clampIndex } from '../queue.ts'
import type { FailoverKey } from './locales.ts'
import { QueuePanel, type QueuePanelApi } from './QueuePanel.tsx'
import { CLASS } from './styles.ts'
import type { FailoverSnapshot } from './state.ts'

/** Registration-side face plus the renderer-bound snapshot hook. */
export interface FailoverChipInjected {
  useFailover: () => FailoverSnapshot
  api: QueuePanelApi
  loadCandidates: (sessionId: string) => Promise<void>
  getSessionId?: () => string
}

export interface FailoverChipProps extends FailoverChipInjected {
  sessionId?: string
  t: (key: FailoverKey) => string
}

function sessionOf(props: FailoverChipProps): string {
  return props.sessionId ?? props.getSessionId?.() ?? ''
}

/**
 * Composer chip: shows P1/P- and opens the drag panel.
 * @param props - composed slot props.
 */
export function FailoverChip(props: FailoverChipProps): ReactNode {
  const { useFailover, api, loadCandidates, t } = props
  const state = useFailover()
  const sessionId = sessionOf(props)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<CSSProperties | null>(null)

  useEffect(() => {
    if (!open) return
    void loadCandidates(sessionId)
  }, [open, loadCandidates, sessionId])

  useLayoutEffect(() => {
    if (!open) return
    const place = (): void => {
      const trigger = rootRef.current
      const panel = panelRef.current
      if (trigger === null || panel === null) return
      const rect = trigger.getBoundingClientRect()
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
      const above = rect.top - 8 - height
      const top = above >= 8 ? above : Math.min(rect.bottom + 8, window.innerHeight - height - 8)
      setPos({ left, top })
    }
    place()
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('resize', place) }
  }, [open, state.queue.length, state.enabled])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent): void => {
      if (rootRef.current?.contains(event.target as Node) === true) return
      if (panelRef.current?.contains(event.target as Node) === true) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label = state.enabled && state.queue.length > 0
    ? `P${clampIndex(state.currentIndex, state.queue.length) + 1}`
    : t('chip.off')

  return (
    <div ref={rootRef}>
      <button
        type="button"
        className={`${CLASS.chip}${state.enabled ? ` ${CLASS.chipOn}` : ''}`}
        aria-pressed={state.enabled}
        aria-expanded={open}
        aria-label={state.enabled ? t('chip.aria.on') : t('chip.aria.off')}
        title={state.enabled ? t('chip.title.on') : t('chip.title.off')}
        onMouseDown={(event) => { event.preventDefault() }}
        onClick={() => { setOpen(value => !value) }}
      >
        {label}
      </button>
      {open && createPortal(
        <div ref={panelRef} style={{ ...pos, position: 'fixed', zIndex: 1100 }}>
          <QueuePanel state={state} api={api} t={t} onClose={() => { setOpen(false) }} />
        </div>,
        document.body,
      )}
    </div>
  )
}

/**
 * Settings tab: the same queue without the composer chip.
 * @param props - composed slot props.
 */
export function FailoverSettingsCard(props: FailoverChipProps): ReactNode {
  const { useFailover, api, loadCandidates, t } = props
  const state = useFailover()
  const sessionId = sessionOf(props)
  useEffect(() => {
    void loadCandidates(sessionId)
  }, [loadCandidates, sessionId])
  return <QueuePanel state={state} api={api} t={t} />
}
