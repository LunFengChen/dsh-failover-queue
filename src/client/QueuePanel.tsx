import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { groupCandidatesByProvider } from '../candidates.ts'
import { clampIndex, indexAfterReorder, reorderQueue, routeDisplay, routeKey } from '../queue.ts'
import type { FailoverCandidate } from '../types.ts'
import type { FailoverKey } from './locales.ts'
import { CLASS } from './styles.ts'
import type { FailoverSnapshot, QueueRoute } from './state.ts'

/** Writes the panel issues against the host settings document. */
export interface QueuePanelApi {
  setEnabled(enabled: boolean): Promise<void>
  setQueue(queue: readonly QueueRoute[], currentIndex: number): Promise<void>
}

export interface QueuePanelProps {
  readonly state: FailoverSnapshot
  readonly api: QueuePanelApi
  readonly t: (key: FailoverKey, params?: Record<string, string | number>) => string
  readonly onClose?: () => void
  /** In-flow settings page; skip the composer popover's fixed positioning. */
  readonly embedded?: boolean
}

function candidateMatches(row: FailoverCandidate, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return [row.provider, row.providerName, row.model, row.name].some(part => part.toLowerCase().includes(needle))
}

/**
 * Drag-reorder P1/P2/P3 list plus the auto-failover switch.
 * @param props - live snapshot, settings writes, locale.
 */
export function QueuePanel({ state, api, t, onClose, embedded = false }: QueuePanelProps): ReactNode {
  const [pending, setPending] = useState(false)
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuPos, setMenuPos] = useState<CSSProperties | null>(null)
  const available = useMemo(() => {
    const taken = new Set(state.queue.map(routeKey))
    return state.candidates.filter(row => !taken.has(routeKey({
      provider: row.provider,
      model: row.model,
    })))
  }, [state.candidates, state.queue])
  const groups = useMemo(() => groupCandidatesByProvider(available), [available])
  const needle = query.trim().toLowerCase()
  const visibleGroups = useMemo(() => {
    if (needle === '') return groups
    return groups.filter(group => (
      group.provider.toLowerCase().includes(needle)
      || group.providerName.toLowerCase().includes(needle)
      || group.models.some(row => candidateMatches(row, query))
    ))
  }, [groups, needle, query])
  const selectedGroup = selectedProvider === null
    ? undefined
    : groups.find(group => group.provider === selectedProvider)
  const visibleModels = useMemo(() => {
    if (selectedGroup === undefined) return []
    if (needle === '') return [...selectedGroup.models]
    return selectedGroup.models.filter(row => candidateMatches(row, query))
  }, [selectedGroup, needle, query])

  const closeMenu = (): void => {
    setMenuOpen(false)
    setSelectedProvider(null)
    setQuery('')
  }

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (event: MouseEvent): void => {
      const target = event.target as Node
      if (pickerRef.current?.contains(target) === true) return
      if (menuRef.current?.contains(target) === true) return
      closeMenu()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (selectedProvider !== null) {
        setSelectedProvider(null)
        return
      }
      closeMenu()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, selectedProvider])

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPos(null)
      return
    }
    const place = (): void => {
      const trigger = pickerRef.current
      if (trigger === null) return
      const rect = trigger.getBoundingClientRect()
      const width = Math.max(rect.width, 280)
      const maxHeight = Math.min(320, Math.floor(window.innerHeight * 0.5))
      const roomAbove = rect.top - 8
      const roomBelow = window.innerHeight - rect.bottom - 8
      const openUp = roomAbove >= 160 || roomAbove >= roomBelow
      const top = openUp
        ? Math.max(8, rect.top - 6 - maxHeight)
        : Math.min(rect.bottom + 6, window.innerHeight - maxHeight - 8)
      setMenuPos({
        position: 'fixed',
        left: Math.min(rect.left, window.innerWidth - width - 8),
        width,
        top,
        maxHeight,
        zIndex: 2100,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [menuOpen, selectedProvider, visibleGroups.length, visibleModels.length, query])

  const run = (work: () => Promise<void>): void => {
    if (pending) return
    setPending(true)
    void work().finally(() => { setPending(false) })
  }

  const onDrop = (to: number, event: DragEvent<HTMLLIElement>): void => {
    event.preventDefault()
    const from = Number(event.dataTransfer.getData('text/plain'))
    if (!Number.isInteger(from) || from === to) return
    const queue = reorderQueue(state.queue, from, to)
    const currentIndex = indexAfterReorder(state.currentIndex, from, to)
    run(() => api.setQueue(queue, currentIndex))
  }

  const addCandidate = (row: FailoverCandidate): void => {
    const route: QueueRoute = {
      provider: row.provider,
      model: row.model,
      label: row.name,
    }
    closeMenu()
    run(() => api.setQueue([...state.queue, route], state.currentIndex))
  }

  const pickerLabel = !state.candidatesLoaded
    ? t('panel.add.loading')
    : groups.length === 0
      ? t('panel.add.none')
      : t('panel.add.placeholderCount', { count: groups.length })

  const emptyMenu = selectedProvider === null
    ? visibleGroups.length === 0
    : visibleModels.length === 0

  return (
    <div
      className={embedded ? `${CLASS.panel} ${CLASS.panelPage}` : CLASS.panel}
      role={embedded ? 'region' : 'dialog'}
      aria-label={t('panel.title')}
    >
      <div className={CLASS.head}>
        <div className={CLASS.title}>{t('panel.title')}</div>
        {onClose === undefined ? null : (
          <button type="button" className={CLASS.remove} onClick={onClose}>{t('panel.close')}</button>
        )}
      </div>
      <div className={CLASS.switchRow}>
        <div className={CLASS.switchCopy}>
          <span>{t('panel.switch')}</span>
          <small>{state.enabled ? t('panel.switch.on') : t('panel.switch.off')}</small>
        </div>
        <button
          type="button"
          role="switch"
          className={`${CLASS.toggle}${state.enabled ? ` ${CLASS.toggleOn}` : ''}`}
          aria-checked={state.enabled}
          aria-label={t('panel.switch')}
          disabled={pending}
          onClick={() => { run(() => api.setEnabled(!state.enabled)) }}
        >
          <span className={CLASS.toggleThumb} />
        </button>
      </div>
      <p className={CLASS.hint}>{t('panel.hint')}</p>
      {state.queue.length === 0 ? (
        <p className={CLASS.empty}>{t('panel.empty')}</p>
      ) : (
        <ul className={CLASS.list}>
          {state.queue.map((route, index) => {
            const active = index === clampIndex(state.currentIndex, state.queue.length)
            const display = routeDisplay(route, state.candidates)
            const title = `${display.provider}/${display.model}`
            return (
              <li
                key={routeKey(route)}
                className={`${CLASS.row}${active ? ` ${CLASS.rowActive}` : ''}`}
                onDragOver={(event) => { event.preventDefault() }}
                onDrop={(event) => { onDrop(index, event) }}
                onClick={() => {
                  if (index === state.currentIndex) return
                  run(() => api.setQueue(state.queue, index))
                }}
              >
                <span
                  className={CLASS.handle}
                  draggable
                  title={t('panel.drag')}
                  aria-label={t('panel.drag')}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', String(index))
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  onClick={(event) => { event.stopPropagation() }}
                >
                  ⋮⋮
                </span>
                <span className={CLASS.badge}>P{index + 1}</span>
                <span className={CLASS.meta}>
                  <span className={CLASS.name}>
                    {title}
                    {active ? ` · ${t('panel.current')}` : ''}
                  </span>
                  <span className={CLASS.sub}>{route.provider} / {route.model}</span>
                </span>
                <button
                  type="button"
                  className={CLASS.remove}
                  aria-label={t('panel.remove')}
                  onClick={(event) => {
                    event.stopPropagation()
                    const queue = state.queue.filter((_, item) => item !== index)
                    const currentIndex = index < state.currentIndex
                      ? state.currentIndex - 1
                      : index === state.currentIndex
                        ? clampIndex(state.currentIndex, queue.length)
                        : state.currentIndex
                    run(() => api.setQueue(queue, currentIndex))
                  }}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className={CLASS.picker} ref={pickerRef}>
        <button
          type="button"
          className={CLASS.pickerBtn}
          disabled={pending || !state.candidatesLoaded || groups.length === 0}
          aria-expanded={menuOpen}
          aria-haspopup="listbox"
          aria-label={t('panel.add')}
          onClick={() => {
            if (menuOpen) {
              closeMenu()
              return
            }
            setMenuOpen(true)
          }}
        >
          {pickerLabel}
        </button>
        {menuOpen && state.candidatesLoaded && groups.length > 0 && menuPos !== null
          ? createPortal(
            <div className={CLASS.menu} ref={menuRef} style={menuPos}>
              {selectedProvider === null ? null : (
                <button
                  type="button"
                  className={CLASS.back}
                  onClick={() => { setSelectedProvider(null) }}
                >
                  ← {t('panel.add.back')}
                </button>
              )}
              <input
                className={CLASS.search}
                value={query}
                autoFocus
                disabled={pending}
                placeholder={selectedProvider === null ? t('panel.add.searchProvider') : t('panel.add.searchModel')}
                aria-label={selectedProvider === null ? t('panel.add.searchProvider') : t('panel.add.searchModel')}
                onChange={(event) => { setQuery(event.target.value) }}
              />
              {emptyMenu ? (
                <p className={CLASS.empty}>{t('panel.add.nomatch')}</p>
              ) : selectedProvider === null ? (
                <ul className={CLASS.catalog} role="listbox" aria-label={t('panel.add')}>
                  {visibleGroups.map((group) => (
                    <li key={group.provider}>
                      <button
                        type="button"
                        className={`${CLASS.catalogItem} ${CLASS.catalogProvider}`}
                        disabled={pending}
                        aria-label={`${group.providerName}, ${t('panel.add.modelCount', { count: group.models.length })}`}
                        onClick={() => { setSelectedProvider(group.provider) }}
                      >
                        <span className={CLASS.meta}>
                          <span className={CLASS.name}>{group.providerName}</span>
                          <span className={CLASS.sub}>{group.provider} · {t('panel.add.modelCount', { count: group.models.length })}</span>
                        </span>
                        <span className={CLASS.chevron} aria-hidden="true">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className={CLASS.catalog} role="listbox" aria-label={selectedGroup?.providerName ?? t('panel.add')}>
                  {visibleModels.map((row) => (
                    <li key={routeKey({ provider: row.provider, model: row.model })}>
                      <button
                        type="button"
                        className={CLASS.catalogItem}
                        role="option"
                        disabled={pending}
                        aria-label={`${t('panel.add')}: ${row.name}`}
                        onClick={() => { addCandidate(row) }}
                      >
                        <span className={CLASS.name}>{row.name}</span>
                        <span className={CLASS.sub}>{row.model}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>,
            document.body,
          )
          : null}
      </div>
    </div>
  )
}
