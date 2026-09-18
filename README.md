# dsh-failover-queue

English | [中文](README.zh.md)

CC Switch-style **P1 / P2 / P3** failover for DeepSeek Harness / xfdsh.

A `P1` / `P-` chip sits on the composer. Click it to:

- Toggle auto failover
- Drag to reorder priority (P1 primary, P2 / P3 backup)
- Add routes from the live provider+model catalog

On failure, same-route `llm-retry` runs first. `AUTH` / `RATE_LIMIT` / `NO_ADAPTER` skip that wait and jump to the next P. While enabled, requests use the active queue slot, not the session picker.

## Install

```sh
dsh plugin --profile web add github:LunFengChen/dsh-failover-queue
```

Local checkout:

```sh
dsh plugin --profile web add /path/to/dsh-failover-queue
```

Reload the Web GUI. The composer shows `P-`. Settings left nav has a **Failover** page with the same queue editor.

## Names

| Use | Name |
|---|---|
| GitHub | `LunFengChen/dsh-failover-queue` |
| npm / package | `@x1a0f3n9/dsh-failover-queue` |
| Plugin id | `dsh-failover-queue` |
| Settings namespace | `dsh-failover-queue` |
| Slash command | `/failover` |

`dsh-llm-failover` is already taken by several GitHub plugins. This name is the P-queue.

## Commands

```
/failover            # print the queue; * is current
/failover on|off     # toggle
```

## Config (cordis.yml)

```yaml
- id: dsh-failover-queue
  config:
    cooldownMs: 60000
    immediateCodes: [AUTH, RATE_LIMIT, NO_ADAPTER]
```

## Limits

- Queue items are **provider + model**, not a whole provider.
- Switching mid-step drops the current KV cache.
- Balance query is not in this version.
- With `retryPolicy.mode: always`, only `immediateCodes` interrupt retries to change P.
