/** Class names shared between the injected DOM and the stylesheet. */
export const CLASS = {
  chip: 'dsh-fq-chip',
  chipOn: 'dsh-fq-chip-on',
  chipKicker: 'dsh-fq-chip-kicker',
  chipPriority: 'dsh-fq-chip-priority',
  chipRoute: 'dsh-fq-chip-route',
  page: 'dsh-fq-page',
  pageIntro: 'dsh-fq-page-intro',
  panel: 'dsh-fq-panel',
  panelPage: 'dsh-fq-panel-page',
  head: 'dsh-fq-head',
  title: 'dsh-fq-title',
  switchRow: 'dsh-fq-switch-row',
  switchCopy: 'dsh-fq-switch-copy',
  hint: 'dsh-fq-hint',
  list: 'dsh-fq-list',
  row: 'dsh-fq-row',
  rowActive: 'dsh-fq-row-active',
  handle: 'dsh-fq-handle',
  badge: 'dsh-fq-badge',
  meta: 'dsh-fq-meta',
  name: 'dsh-fq-name',
  sub: 'dsh-fq-sub',
  remove: 'dsh-fq-remove',
  picker: 'dsh-fq-picker',
  pickerBtn: 'dsh-fq-picker-btn',
  menu: 'dsh-fq-menu',
  search: 'dsh-fq-search',
  catalog: 'dsh-fq-catalog',
  catalogItem: 'dsh-fq-catalog-item',
  empty: 'dsh-fq-empty',
  toggle: 'dsh-fq-toggle',
  toggleOn: 'dsh-fq-toggle-on',
  toggleThumb: 'dsh-fq-toggle-thumb',
} as const

/** One injected stylesheet scoped under `.dsh-fq-*`. */
export const STYLE = `
.dsh-fq-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: min(280px, 42vw);
  height: 22px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: var(--dsw-alias-fill-tsp-secondary, rgba(255,255,255,0.06));
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 22px;
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
}
.dsh-fq-chip:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.10));
}
.dsh-fq-chip-on {
  background: color-mix(in srgb, var(--dsw-alias-label-accent, #34d399) 16%, transparent);
  color: var(--dsw-alias-label-accent, #34d399);
}
.dsh-fq-chip-kicker {
  flex-shrink: 0;
  font-weight: 600;
}
.dsh-fq-chip-priority {
  flex-shrink: 0;
  font-weight: 700;
}
.dsh-fq-chip-route {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-fq-panel {
  position: fixed;
  z-index: 1100;
  width: 320px;
  max-height: min(420px, calc(100vh - 24px));
  overflow: visible;
  padding: 12px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.12));
  border-radius: 12px;
  background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-3, #1c1c1e));
  box-shadow: var(--dsw-shadow-lv3, 0 12px 40px rgba(0,0,0,0.35));
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 13px;
  line-height: 18px;
}
.dsh-fq-page {
  max-width: 560px;
  padding: 4px 0 24px;
}
.dsh-fq-page-intro {
  margin: 0 0 12px;
  color: var(--dsw-alias-label-tertiary, #8e8e93);
  font-size: 13px;
  line-height: 18px;
}
.dsh-fq-page .dsh-fq-panel,
.dsh-fq-panel.dsh-fq-panel-page {
  position: static;
  z-index: auto;
  width: auto;
  max-height: none;
  overflow: visible;
  box-shadow: none;
}
.dsh-fq-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.dsh-fq-title {
  font-size: 14px;
  font-weight: 600;
}
.dsh-fq-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.dsh-fq-switch-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.dsh-fq-switch-copy small {
  color: var(--dsw-alias-label-tertiary, #8e8e93);
  font-size: 11px;
}
.dsh-fq-hint, .dsh-fq-empty {
  color: var(--dsw-alias-label-tertiary, #8e8e93);
  font-size: 12px;
  margin: 0 0 8px;
}
.dsh-fq-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}
.dsh-fq-row {
  display: grid;
  grid-template-columns: 16px 32px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--dsw-alias-fill-tsp-secondary, rgba(255,255,255,0.04));
  cursor: pointer;
}
.dsh-fq-row:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.08));
}
.dsh-fq-row-active {
  outline: 1px solid color-mix(in srgb, var(--dsw-alias-label-accent, #34d399) 50%, transparent);
}
.dsh-fq-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--dsw-alias-label-tertiary, #8e8e93);
  cursor: grab;
}
.dsh-fq-handle:active { cursor: grabbing; }
.dsh-fq-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--dsw-alias-label-accent, #34d399);
}
.dsh-fq-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.dsh-fq-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.dsh-fq-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary, #8e8e93);
  font-size: 11px;
}
.dsh-fq-remove {
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #8e8e93);
  cursor: pointer;
  border-radius: 6px;
  height: 24px;
  padding: 0 6px;
}
.dsh-fq-remove:hover {
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.08));
}
.dsh-fq-picker {
  position: relative;
  margin-top: 8px;
}
.dsh-fq-picker-btn {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.12));
  background: var(--dsw-alias-bg-layer-2, #141416);
  color: var(--dsw-alias-label-primary, #f5f5f7);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.dsh-fq-picker-btn:disabled {
  cursor: default;
  opacity: 0.65;
}
.dsh-fq-menu {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.12));
  border-radius: 8px;
  background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-3, #1c1c1e));
  box-shadow: var(--dsw-shadow-lv3, 0 12px 40px rgba(0,0,0,0.45));
  color: var(--dsw-alias-label-primary, #f5f5f7);
  box-sizing: border-box;
}
.dsh-fq-search {
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.12));
  background: var(--dsw-alias-bg-layer-2, #141416);
  color: var(--dsw-alias-label-primary, #f5f5f7);
  font-size: 12px;
  padding: 0 8px;
}
.dsh-fq-search::placeholder {
  color: var(--dsw-alias-label-tertiary, #8e8e93);
}
.dsh-fq-catalog {
  display: flex;
  flex-direction: column;
  flex: 1;
  margin: 0;
  padding: 0;
  list-style: none;
  min-height: 0;
  overflow: auto;
}
.dsh-fq-catalog-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  width: 100%;
  margin: 0;
  padding: 5px 10px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary, #f5f5f7);
  text-align: left;
  cursor: pointer;
}
.dsh-fq-catalog-item:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.08));
}
.dsh-fq-catalog-item:disabled {
  cursor: default;
  opacity: 0.6;
}
.dsh-fq-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
  border: 0;
  border-radius: 10px;
  background: var(--dsw-alias-fill-tsp-secondary, rgba(255,255,255,0.18));
  cursor: pointer;
  padding: 0;
}
.dsh-fq-toggle-on {
  background: var(--dsw-alias-label-accent, #34d399);
}
.dsh-fq-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 120ms ease;
}
.dsh-fq-toggle-on .dsh-fq-toggle-thumb {
  transform: translateX(16px);
}
`
