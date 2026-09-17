import { useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { clampIndex, indexAfterReorder, reorderQueue, routeDisplay, routeKey } from '../queue.ts'
import type { FailoverKey } from './locales.ts'
import { CLASS } from './styles.ts'
import type { FailoverCandidate, FailoverSnapshot, QueueRoute } from './state.ts'

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
}

/**
 * Drag-reorder P1/P2/P3 list plus the auto-failover switch.
 * @param props - live snapshot, settings writes, locale.
 */
export function QueuePanel({ state, api, t, onClose }: QueuePanelProps): ReactNode {
  const [pending, setPending] = useState(false)
  const [pick, setPick] = useState('')
  const available = useMemo(() => {
    const taken = new Set(state.queue.map(routeKey))
    return state.candidates.filter(row => !taken.has(routeKey({
      provider: row.provider,
      model: row.model,
    })))
  }, [state.candidates, state.queue])

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

  const add = (): void => {
    const [provider, model] = pick.split('\0')
    if (provider === undefined || model === undefined || provider === '' || model === '') return
    const candidate = state.candidates.find(row => row.provider === provider && row.model === model)
    const route: QueueRoute = {
      provider,
      model,
      ...candidate === undefined ? {} : { label: candidate.name },
    }
    const queue = [...state.queue, route]
    setPick('')
    run(() => api.setQueue(queue, state.currentIndex))
  }

  return (
    <div className={CLASS.panel} role="dialog" aria-label={t('panel.title')}>
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
      <div className={CLASS.addRow}>
        <select
          className={CLASS.select}
          value={pick}
          disabled={pending || available.length === 0}
          onChange={(event) => { setPick(event.target.value) }}
          aria-label={t('panel.add')}
        >
          <option value="">{t('panel.add.placeholder')}</option>
          {available.map((row) => (
            <option key={`${row.provider}\0${row.model}`} value={`${row.provider}\0${row.model}`}>
              {row.providerName} / {row.name}
            </option>
          ))}
        </select>
        <button type="button" disabled={pending || pick === ''} onClick={add}>
          {t('panel.add')}
        </button>
      </div>
    </div>
  )
}
