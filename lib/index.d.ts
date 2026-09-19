import z from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";

//#region src/types.d.ts
/** One provider+model slot in the failover queue. P1 is index 0. */
interface QueueRoute {
  /** Adapter route key (`GenerateOptions.provider`). */
  readonly provider: string;
  /** Model id for that route. */
  readonly model: string;
  /** Optional display label; the chip falls back to `provider/model`. */
  readonly label?: string;
}
/** Closed = healthy, Open = skipped, HalfOpen = one probe. */
type CircuitState = 'closed' | 'open' | 'half_open';
/** Host-projected breaker badge for one queue route. Memory-only on the host. */
interface CircuitHealth {
  readonly provider: string;
  readonly model: string;
  readonly state: CircuitState;
  readonly failures: number;
}
/** Persisted failover document (settings namespace `dsh-failover-queue`). */
interface FailoverSettings {
  /** When false, the plugin never overlays or retries across routes. */
  enabled: boolean;
  /** Last picked queue index (P1 = 0). Clamped on read. Not a sticky pointer. */
  currentIndex: number;
  /** Ordered routes. Index 0 is P1. */
  queue: QueueRoute[];
  /** Live circuit badges. Host memory is the source of truth. */
  circuits?: CircuitHealth[];
}
/** One advertised catalog row the panel can add. */
interface FailoverCandidate {
  readonly provider: string;
  readonly providerName: string;
  readonly model: string;
  readonly name: string;
}
//#endregion
//#region src/config.d.ts
/** Plugin config accepted from cordis.yml / the bundle patch. */
interface Config {
  /** Milliseconds an Open circuit waits before a HalfOpen probe. Default 60000. */
  cooldownMs?: number;
  /** Consecutive failures that open a Closed breaker. Default 2. */
  failureThreshold?: number;
  /** Consecutive HalfOpen successes that close the breaker. Default 2. */
  successThreshold?: number;
  /**
   * Failure codes that skip remaining same-route retries, open the circuit
   * immediately, and jump to the next P. Default `AUTH`, `RATE_LIMIT`, `NO_ADAPTER`.
   */
  immediateCodes?: string[];
}
/** Config after schema defaults. */
interface ResolvedConfig {
  cooldownMs: number;
  failureThreshold: number;
  successThreshold: number;
  immediateCodes: readonly string[];
}
/** Runtime schema. */
declare const Config: z<Config>;
/**
 * Apply schema defaults.
 * @param config - raw plugin config, possibly partial.
 */
declare function resolveConfig(config?: Config): ResolvedConfig;
/** Settings namespace (hyphenated; settings forbids dots). */
declare const SETTINGS_NAMESPACE = "dsh-failover-queue";
//#endregion
//#region src/queue.d.ts
/** Stable identity for cooldown and de-dupe. */
declare function routeKey(route: QueueRoute): string;
/**
 * Clamp a queue index into `[0, length)` (or `0` when empty).
 * @param index - requested index.
 * @param length - queue length.
 * @returns a usable index.
 */
declare function clampIndex(index: number, length: number): number;
/**
 * Move one queue item from `from` to `to`.
 * @param queue - current ordered routes.
 * @param from - source index.
 * @param to - destination index.
 * @returns a new array.
 */
declare function reorderQueue(queue: readonly QueueRoute[], from: number, to: number): QueueRoute[];
/**
 * Follow the same route after a drag, not the same slot.
 * @param currentIndex - active index before the move.
 * @param from - dragged index.
 * @param to - drop index.
 * @returns the index of the previously active route.
 */
declare function indexAfterReorder(currentIndex: number, from: number, to: number): number;
/**
 * Next uncooled route after `currentIndex`, wrapping once.
 * @param queue - ordered routes.
 * @param currentIndex - failed slot.
 * @param isCooled - true when this route should be skipped.
 * @returns the next index, or `undefined` when nothing remains.
 */
declare function advanceIndex(queue: readonly QueueRoute[], currentIndex: number, isCooled: (route: QueueRoute) => boolean): number | undefined;
/**
 * Drop duplicate provider+model pairs, keeping the first occurrence.
 * @param queue - possibly messy user input.
 */
declare function dedupeQueue(queue: readonly QueueRoute[]): QueueRoute[];
/**
 * Names the chip and queue rows show for one route.
 * Prefers the live catalog's provider/model titles, then the stored label.
 * @param route - queue slot.
 * @param candidates - advertised catalog, possibly empty.
 */
declare function routeDisplay(route: QueueRoute, candidates?: readonly FailoverCandidate[]): {
  provider: string;
  model: string;
};
//#endregion
//#region src/circuit.d.ts
/** Closed / Open / HalfOpen knobs. Chat-friendly defaults, CC Switch-shaped. */
interface CircuitConfig {
  /** Consecutive failures that open a Closed breaker. */
  readonly failureThreshold: number;
  /** Consecutive HalfOpen successes that close the breaker. */
  readonly successThreshold: number;
  /** Milliseconds an Open breaker waits before becoming HalfOpen. */
  readonly timeoutMs: number;
}
/** Result of taking a HalfOpen probe permit. */
interface ProbeDecision {
  readonly allowed: boolean;
  readonly halfOpen: boolean;
}
/** One queue pick: first Closed, else first HalfOpen. */
interface CircuitPick {
  readonly index: number;
  readonly route: QueueRoute;
  readonly halfOpen: boolean;
}
/**
 * One route's Closed / Open / HalfOpen breaker.
 *
 * HalfOpen allows a single in-flight probe. Open becomes HalfOpen after
 * `timeoutMs`. Immediate failures (AUTH / RATE_LIMIT / NO_ADAPTER) open on
 * the first hit. Memory-only: a process restart starts Closed.
 */
declare class CircuitBreaker {
  private readonly config;
  private state;
  private failures;
  private successes;
  private openedAt;
  private halfOpenPermit;
  /**
   * @param config - thresholds and Open timeout.
   */
  constructor(config: CircuitConfig);
  /** Copy of counters for badges and tests. */
  snapshot(): {
    readonly state: CircuitState;
    readonly failures: number;
    readonly successes: number;
    readonly openedAt: number | null;
  };
  /**
   * Whether this route may be selected. Open → HalfOpen when the wait elapses.
   * Does not consume the probe permit.
   * @param now - epoch ms.
   */
  isAvailable(now: number): boolean;
  /**
   * Reserve this route for one request. HalfOpen consumes the single permit.
   * @param now - epoch ms.
   */
  allowProbe(now: number): ProbeDecision;
  /** Probe succeeded. Two successes close a HalfOpen breaker. */
  recordSuccess(): void;
  /**
   * Probe or Closed request failed.
   * @param now - epoch ms used as Open timestamp.
   * @param immediate - open on this hit regardless of `failureThreshold`.
   */
  recordFailure(now: number, immediate?: boolean): void;
  /** Drop the HalfOpen permit without changing health (cancel / abandon). */
  releaseProbe(): void;
  private maybeHalfOpen;
  private transitionOpen;
  private transitionClosed;
}
/** Per-route breaker map. Missing keys start Closed. */
declare class CircuitBank {
  private readonly config;
  private readonly breakers;
  /**
   * @param config - shared knobs for every route.
   */
  constructor(config: CircuitConfig);
  /**
   * Breaker for one provider+model pair.
   * @param key - {@link routeKey}.
   */
  get(key: string): CircuitBreaker;
  /**
   * Badge rows for the live queue. Touches `isAvailable` so Open can show
   * HalfOpen after the wait without consuming a permit.
   * @param queue - ordered routes.
   * @param now - epoch ms.
   */
  health(queue: readonly QueueRoute[], now: number): CircuitHealth[];
}
/**
 * First Closed route, else first HalfOpen with a free permit. Never sticky.
 * @param queue - P1…Pn.
 * @param bank - per-route breakers.
 * @param now - epoch ms.
 * @param skip - route key to ignore (the attempt that just failed).
 */
declare function pickFirstAvailable(queue: readonly QueueRoute[], bank: CircuitBank, now: number, skip?: string): CircuitPick | undefined;
/**
 * Queue index of the first available route, without consuming a probe permit.
 * @param queue - P1…Pn.
 * @param bank - per-route breakers.
 * @param now - epoch ms.
 * @param skip - route key to ignore.
 */
declare function firstAvailableIndex(queue: readonly QueueRoute[], bank: CircuitBank, now: number, skip?: string): number | undefined;
/**
 * Badge tone for one queue row.
 * @param health - host snapshot for this route, if any.
 */
declare function circuitTone(health: CircuitHealth | undefined): 'ok' | 'probe' | 'open';
/**
 * Match a queue route to a health row.
 * @param route - queue slot.
 * @param circuits - host snapshot.
 */
declare function healthFor(route: QueueRoute, circuits: readonly CircuitHealth[]): CircuitHealth | undefined;
//#endregion
//#region src/command.d.ts
/** `/failover` verbs the host handler and tests share. */
type FailoverVerb = {
  readonly kind: 'status';
} | {
  readonly kind: 'on';
} | {
  readonly kind: 'off';
} | {
  readonly kind: 'candidates';
} | {
  readonly kind: 'error';
  readonly text: string;
};
/**
 * Parse `/failover` arguments.
 * @param rawInput - text after the command name.
 */
declare function parseFailoverArg(rawInput: string): FailoverVerb;
//#endregion
//#region src/index.d.ts
declare const name = "dsh-failover-queue";
declare const inject: string[];
/**
 * Mount settings, `/failover`, and the request overlay.
 * @param ctx - plugin context; requires `llm`.
 * @param config - raw plugin config.
 */
declare function apply(ctx: Context, config?: Config): void;
//#endregion
export { CircuitBank, CircuitBreaker, type CircuitHealth, type CircuitState, Config, type Config as ConfigInput, type FailoverCandidate, type FailoverSettings, type QueueRoute, type ResolvedConfig, SETTINGS_NAMESPACE, advanceIndex, apply, circuitTone, clampIndex, dedupeQueue, firstAvailableIndex, healthFor, indexAfterReorder, inject, name, parseFailoverArg, pickFirstAvailable, reorderQueue, resolveConfig, routeDisplay, routeKey };