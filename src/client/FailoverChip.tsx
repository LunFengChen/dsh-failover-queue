import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { clampIndex, routeDisplay } from '../queue.ts'
import type { FailoverKey } from './locales.ts'
import { placeComposerPanel } from './place.ts'
import { QueuePanel, type QueuePanelApi } from './QueuePanel.tsx'
import { CLASS } from './styles.ts'
import type { FailoverSnapshot } from './state.ts'

type Translate = (key: FailoverKey, params?: Record<string, string | number>) => string

/** Registration-side face plus the renderer-bound snapshot hook. */
export interface FailoverChipInjected {
  /** Slot renderer binds `hooks.failover` as a selector hook, not a zero-arg reader. */
  useFailover: <S>(selector: (snapshot: FailoverSnapshot) => S) => S
  api: QueuePanelApi
  loadCandidates: (sessionId: string) => Promise<void>
  getSessionId?: () => string
}

export interface FailoverChipProps extends FailoverChipInjected {
  sessionId?: string
  t: Translate
}

function sessionOf(props: FailoverChipProps): string {
  return props.sessionId ?? props.getSessionId?.() ?? ''
}

function chipCopy(state: FailoverSnapshot, t: Translate): {
  title: string
  aria: string
  slot: number | undefined
  route: string | undefined
} {
  if (!state.enabled) {
    return { title: t('chip.title.off'), aria: t('chip.aria.off'), slot: undefined, route: undefined }
  }
  if (state.queue.length === 0) {
    return {
      title: t('chip.empty'),
      aria: t('chip.empty'),
      slot: undefined,
      route: t('chip.empty'),
    }
  }
  const slot = clampIndex(state.currentIndex, state.queue.length) + 1
  const current = state.queue[slot - 1]
  if (current === undefined) {
    return {
      title: t('chip.empty'),
      aria: t('chip.empty'),
      slot: undefined,
      route: t('chip.empty'),
    }
  }
  const display = routeDisplay(current, state.candidates)
  const params = { slot, provider: display.provider, model: display.model }
  return {
    title: t('chip.on', params),
    aria: t('chip.aria.on', params),
    slot,
    route: `${display.provider}/${display.model}`,
  }
}

/**
 * Composer chip: shows failover status and opens the drag panel.
 * @param props - composed slot props.
 */
export function FailoverChip(props: FailoverChipProps): ReactNode {
  const { useFailover, api, loadCandidates, t } = props
  const state = useFailover(snapshot => snapshot)
  const sessionId = sessionOf(props)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<CSSProperties | null>(null)
  const copy = chipCopy(state, t)

  useEffect(() => {
    void loadCandidates(sessionId)
  }, [loadCandidates, sessionId])

  useLayoutEffect(() => {
    if (!open) return
    const place = (): void => {
      const trigger = rootRef.current
      const panel = panelRef.current
      if (trigger === null || panel === null) return
      const rect = trigger.getBoundingClientRect()
      const placed = placeComposerPanel({
        trigger: rect,
        width: panel.offsetWidth,
        height: panel.offsetHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })
      setPos({
        left: placed.left,
        top: placed.top,
        maxHeight: placed.maxHeight,
      })
    }
    place()
    const observer = new ResizeObserver(place)
    if (panelRef.current !== null) observer.observe(panelRef.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, state.queue.length, state.enabled, copy.route])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target) === true) return
      if (panelRef.current?.contains(target) === true) return
      if (target instanceof Element && target.closest('.dsh-fq-menu') !== null) return
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

  return (
    <div ref={rootRef}>
      <button
        type="button"
        className={`${CLASS.chip}${state.enabled ? ` ${CLASS.chipOn}` : ''}`}
        aria-pressed={state.enabled}
        aria-expanded={open}
        aria-label={copy.aria}
        title={copy.title}
        onMouseDown={(event) => { event.preventDefault() }}
        onClick={() => { setOpen(value => !value) }}
      >
        <span className={CLASS.chipKicker}>{t('chip.kicker')}</span>
        {copy.slot === undefined
          ? <span className={CLASS.chipRoute}>{copy.route ?? t('chip.off')}</span>
          : (
            <>
              <span className={CLASS.chipPriority}>P{copy.slot}</span>
              <span className={CLASS.chipRoute}>{copy.route}</span>
            </>
          )}
      </button>
      {open && createPortal(
        <div ref={panelRef} style={{ ...pos, position: 'fixed', zIndex: 2000, overflow: 'auto' }}>
          <QueuePanel state={state} api={api} t={t} onClose={() => { setOpen(false) }} />
        </div>,
        document.body,
      )}
    </div>
  )
}

/**
 * Settings left-nav page: the same queue editor, in document flow.
 * @param props - composed slot props.
 */
export function FailoverSettingsCard(props: FailoverChipProps): ReactNode {
  const { useFailover, api, loadCandidates, t } = props
  const state = useFailover(snapshot => snapshot)
  const sessionId = sessionOf(props)
  useEffect(() => {
    void loadCandidates(sessionId)
  }, [loadCandidates, sessionId])
  return (
    <div className={CLASS.page}>
      <p className={CLASS.pageIntro}>{t('settings.intro')}</p>
      <QueuePanel state={state} api={api} t={t} embedded />
    </div>
  )
}
