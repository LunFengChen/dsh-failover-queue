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
  | 'panel.add.placeholderCount'
  | 'panel.add.searchProvider'
  | 'panel.add.searchModel'
  | 'panel.add.back'
  | 'panel.add.modelCount'
  | 'panel.add.loading'
  | 'panel.add.none'
  | 'panel.add.nomatch'
  | 'panel.remove'
  | 'panel.drag'
  | 'panel.current'
  | 'panel.close'
  | 'panel.hint'
  | 'panel.health.ok'
  | 'panel.health.probe'
  | 'panel.health.open'
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
  'panel.switch.on': '失败按 P1 → P2 → P3 切换；P1 恢复后探活切回',
  'panel.switch.off': '只用当前会话模型，不跨路由',
  'panel.empty': '队列是空的。从下面点一条路由，P1 就是主供应商。',
  'panel.add': '加入队列',
  'panel.add.placeholderCount': '选择供应商（{count}）',
  'panel.add.searchProvider': '搜索供应商…',
  'panel.add.searchModel': '搜索模型…',
  'panel.add.back': '返回供应商',
  'panel.add.modelCount': '{count} 个模型',
  'panel.add.loading': '正在读取已配置的模型…',
  'panel.add.none': '没有可加的路由。先在「模型」里配供应商。',
  'panel.add.nomatch': '没有匹配的路由。',
  'panel.remove': '移除',
  'panel.drag': '拖动改优先级',
  'panel.current': '当前',
  'panel.close': '关闭',
  'panel.hint': '拖动左侧手柄调整 P1/P2/P3。失败切下一档；P1 恢复后会探活切回，不会粘在 P2。',
  'panel.health.ok': '健康',
  'panel.health.probe': '探活中',
  'panel.health.open': '已熔断',
  'settings.tab': '故障转移',
  'settings.intro': '编排 P1 / P2 / P3。开启后请求优先 P1；失败熔断后切备用档，P1 恢复后探活切回。',
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
  'panel.switch.on': 'On failure, switch P1 → P2 → P3; recovered P1 is probed again',
  'panel.switch.off': 'Use the session model only',
  'panel.empty': 'Queue is empty. Click a route below. P1 is the primary.',
  'panel.add': 'Add to queue',
  'panel.add.placeholderCount': 'Pick a provider ({count})',
  'panel.add.searchProvider': 'Search providers…',
  'panel.add.searchModel': 'Search models…',
  'panel.add.back': 'Back to providers',
  'panel.add.modelCount': '{count} models',
  'panel.add.loading': 'Loading configured models…',
  'panel.add.none': 'No routes to add. Configure a provider under Models first.',
  'panel.add.nomatch': 'No matching routes.',
  'panel.remove': 'Remove',
  'panel.drag': 'Drag to reorder',
  'panel.current': 'current',
  'panel.close': 'Close',
  'panel.hint': 'Drag the handle to change P1/P2/P3. Failover is not sticky: P1 is probed again after it recovers.',
  'panel.health.ok': 'healthy',
  'panel.health.probe': 'probing',
  'panel.health.open': 'open',
  'settings.tab': 'Failover',
  'settings.intro': 'Arrange P1 / P2 / P3. While on, requests prefer P1. A recovered P1 is probed and selected again.',
}
