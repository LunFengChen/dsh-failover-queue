# dsh-failover-queue

CC Switch 风格的 **P1 / P2 / P3** 故障转移插件，给 DeepSeek Harness / xfdsh 用。

输入框右侧有一颗 `P1` / `P-` 芯片。点开后：

- 开关控制自动故障转移
- 拖动手柄改优先级（P1 主，P2 / P3 备用）
- 从当前已配置的供应商+模型里加路由

失败时：同一条路由先走 `llm-retry`；`AUTH` / `RATE_LIMIT` / `NO_ADAPTER` 立刻切下一条。开启后请求打到队列里当前那条，不看会话里随手选的模型。

## 安装

```sh
dsh plugin --profile web add github:LunFengChen/dsh-failover-queue
```

本地开发：

```sh
dsh plugin --profile web add /path/to/dsh-failover-queue
```

装完刷新 Web GUI。输入框右侧会出现 `P-`。设置左侧导航有独立的 **故障转移** 页，里面是同一套队列编辑。

## 命名

| 用途 | 名字 |
|---|---|
| GitHub | `LunFengChen/dsh-failover-queue` |
| npm / 包 | `@x1a0f3n9/dsh-failover-queue` |
| 插件 id | `dsh-failover-queue` |
| 设置命名空间 | `dsh-failover-queue` |
| 斜杠命令 | `/failover` |

不用 `dsh-llm-failover`：GitHub 上已经有好几份同名插件，这个名字专门表示 **P 队列**。

## 命令

```
/failover            # 打印队列，* 是当前
/failover on|off     # 开关
```

## 配置（cordis.yml）

```yaml
- id: dsh-failover-queue
  config:
    cooldownMs: 60000
    immediateCodes: [AUTH, RATE_LIMIT, NO_ADAPTER]
```

## 限制

- 队列项是 **供应商 + 模型**，不是整条供应商。
- 同一步切路由会丢掉当前 KV cache。
- 余额查询还没做；下个版本按 host 打 DeepSeek / 硅基 / OpenRouter 的余额接口。
- `retryPolicy.mode: always` 时，只有 `immediateCodes` 会打断重试去切 P。
