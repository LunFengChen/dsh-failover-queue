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
/** Persisted failover document (settings namespace `dsh-failover-queue`). */
interface FailoverSettings {
  /** When false, the plugin never overlays or retries across routes. */
  enabled: boolean;
  /** Active queue index (P1 = 0). Clamped on read. */
  currentIndex: number;
  /** Ordered routes. Index 0 is P1. */
  queue: QueueRoute[];
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
  /** Milliseconds a failed route stays skipped. Default 60000. */
  cooldownMs?: number;
  /**
   * Failure codes that skip remaining same-route retries and jump to the
   * next P immediately. Default `AUTH`, `RATE_LIMIT`, `NO_ADAPTER`.
   */
  immediateCodes?: string[];
}
/** Config after schema defaults. */
interface ResolvedConfig {
  cooldownMs: number;
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
export { Config, type Config as ConfigInput, type FailoverCandidate, type FailoverSettings, type QueueRoute, type ResolvedConfig, SETTINGS_NAMESPACE, advanceIndex, apply, clampIndex, dedupeQueue, indexAfterReorder, inject, name, parseFailoverArg, reorderQueue, resolveConfig, routeDisplay, routeKey };