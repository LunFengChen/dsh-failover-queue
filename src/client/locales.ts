/** Locale bundles for the failover chip and drag panel. */
export const NS = 'failover' as const

/** Keys owned by this dictionary. */
export type FailoverKey =
  | 'chip.kicker'
  | 'chip.off'
  | 'chip.empty'
  | 'chip.on'
  | 'chip.aria.on'
  | 'chip.aria.off'
  | 'chip.title.off'
  | 'panel.title'
  | 'panel.switch'
  | 'panel.switch.on'
  | 'panel.switch.off'
  | 'panel.empty'
  | 'panel.add'
  | 'panel.add.placeholder'
  | 'panel.remove'
  | 'panel.drag'
  | 'panel.current'
  | 'panel.close'
  | 'panel.hint'
  | 'settings.tab'
  | 'settings.intro'

export const zh: Record<FailoverKey, string> = {
  'chip.kicker': '故障转移：',
  'chip.off': '关',
  'chip.empty': '无队列',
  'chip.on': '故障转移：P{slot} {provider}/{model}',
  'chip.aria.on': '故障转移已开启，当前 P{slot} {provider}/{model}，点击打开队列',
  'chip.aria.off': '故障转移已关闭，点击打开队列',
  'chip.title.off': '自动故障转移关闭。点进去开启并编排队列。',
  'panel.title': '故障转移队列',
  'panel.switch': '自动故障转移',
  'panel.switch.on': '失败按 P1 → P2 → P3 切换',
  'panel.switch.off': '只用当前会话模型，不跨路由',
  'panel.empty': '队列是空的。从下面加一条路由，P1 就是主供应商。',
  'panel.add': '加入队列',
  'panel.add.placeholder': '选择一条路由…',
  'panel.remove': '移除',
  'panel.drag': '拖动改优先级',
  'panel.current': '当前',
  'panel.close': '关闭',
  'panel.hint': '拖动左侧手柄调整 P1/P2/P3。点一行设为当前。',
  'settings.tab': '故障转移',
  'settings.intro': '编排 P1 / P2 / P3。开启后请求走队列当前档，不看会话里随手选的模型。',
}

export const en: Record<FailoverKey, string> = {
  'chip.kicker': 'Failover: ',
  'chip.off': 'Off',
  'chip.empty': 'empty',
  'chip.on': 'Failover: P{slot} {provider}/{model}',
  'chip.aria.on': 'Failover on, current P{slot} {provider}/{model}, click to open the queue',
  'chip.aria.off': 'Failover off, click to open the queue',
  'chip.title.off': 'Auto failover is off. Click to enable and edit the queue.',
  'panel.title': 'Failover queue',
  'panel.switch': 'Auto failover',
  'panel.switch.on': 'On failure, switch P1 → P2 → P3',
  'panel.switch.off': 'Use the session model only',
  'panel.empty': 'Queue is empty. Add a route below. P1 is the primary.',
  'panel.add': 'Add to queue',
  'panel.add.placeholder': 'Pick a route…',
  'panel.remove': 'Remove',
  'panel.drag': 'Drag to reorder',
  'panel.current': 'current',
  'panel.close': 'Close',
  'panel.hint': 'Drag the handle to change P1/P2/P3. Click a row to make it current.',
  'settings.tab': 'Failover',
  'settings.intro': 'Arrange P1 / P2 / P3. While on, requests use the active queue slot, not the session picker.',
}
