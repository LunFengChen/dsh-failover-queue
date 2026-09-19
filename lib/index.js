import z from "@deepseek-ai/schemastery";

//#region src/queue.ts
/** Stable identity for cooldown and de-dupe. */
function routeKey(route) {
	return `${route.provider}\0${route.model}`;
}
/**
* Clamp a queue index into `[0, length)` (or `0` when empty).
* @param index - requested index.
* @param length - queue length.
* @returns a usable index.
*/
function clampIndex(index, length) {
	if (length <= 0) return 0;
	if (!Number.isFinite(index)) return 0;
	const whole = Math.trunc(index);
	if (whole < 0) return 0;
	if (whole >= length) return length - 1;
	return whole;
}
/**
* Move one queue item from `from` to `to`.
* @param queue - current ordered routes.
* @param from - source index.
* @param to - destination index.
* @returns a new array.
*/
function reorderQueue(queue, from, to) {
	if (from === to) return [...queue];
	if (from < 0 || from >= queue.length) return [...queue];
	if (to < 0 || to >= queue.length) return [...queue];
	const next = [...queue];
	const [item] = next.splice(from, 1);
	if (item === void 0) return next;
	next.splice(to, 0, item);
	return next;
}
/**
* Follow the same route after a drag, not the same slot.
* @param currentIndex - active index before the move.
* @param from - dragged index.
* @param to - drop index.
* @returns the index of the previously active route.
*/
function indexAfterReorder(currentIndex, from, to) {
	if (currentIndex === from) return to;
	if (from < currentIndex && to >= currentIndex) return currentIndex - 1;
	if (from > currentIndex && to <= currentIndex) return currentIndex + 1;
	return currentIndex;
}
/**
* Next uncooled route after `currentIndex`, wrapping once.
* @param queue - ordered routes.
* @param currentIndex - failed slot.
* @param isCooled - true when this route should be skipped.
* @returns the next index, or `undefined` when nothing remains.
*/
function advanceIndex(queue, currentIndex, isCooled) {
	if (queue.length < 2) return void 0;
	const start = clampIndex(currentIndex, queue.length);
	for (let step = 1; step < queue.length; step += 1) {
		const index = (start + step) % queue.length;
		const route = queue[index];
		if (route !== void 0 && !isCooled(route)) return index;
	}
}
/**
* True when this failure should skip remaining same-route retries.
* @param code - provider-neutral `LlmFailure.code`.
* @param immediateCodes - configured trip codes.
*/
function shouldFailoverImmediately(code, immediateCodes) {
	return immediateCodes.includes(code);
}
/**
* Drop duplicate provider+model pairs, keeping the first occurrence.
* @param queue - possibly messy user input.
*/
function dedupeQueue(queue) {
	const seen = /* @__PURE__ */ new Set();
	const next = [];
	for (const route of queue) {
		const provider = route.provider.trim();
		const model = route.model.trim();
		if (provider === "" || model === "") continue;
		const key = routeKey({
			provider,
			model
		});
		if (seen.has(key)) continue;
		seen.add(key);
		next.push({
			provider,
			model,
			...route.label === void 0 || route.label.trim() === "" ? {} : { label: route.label.trim() }
		});
	}
	return next;
}
/**
* Names the chip and queue rows show for one route.
* Prefers the live catalog's provider/model titles, then the stored label.
* @param route - queue slot.
* @param candidates - advertised catalog, possibly empty.
*/
function routeDisplay(route, candidates = []) {
	const hit = candidates.find((row) => row.provider === route.provider && row.model === route.model);
	return {
		provider: hit?.providerName.trim() || route.provider,
		model: route.label?.trim() || hit?.name.trim() || route.model
	};
}

//#endregion
//#region src/circuit.ts
/**
* One route's Closed / Open / HalfOpen breaker.
*
* HalfOpen allows a single in-flight probe. Open becomes HalfOpen after
* `timeoutMs`. Immediate failures (AUTH / RATE_LIMIT / NO_ADAPTER) open on
* the first hit. Memory-only: a process restart starts Closed.
*/
var CircuitBreaker = class {
	state = "closed";
	failures = 0;
	successes = 0;
	openedAt = null;
	halfOpenPermit = 0;
	/**
	* @param config - thresholds and Open timeout.
	*/
	constructor(config) {
		this.config = config;
	}
	/** Copy of counters for badges and tests. */
	snapshot() {
		return {
			state: this.state,
			failures: this.failures,
			successes: this.successes,
			openedAt: this.openedAt
		};
	}
	/**
	* Whether this route may be selected. Open → HalfOpen when the wait elapses.
	* Does not consume the probe permit.
	* @param now - epoch ms.
	*/
	isAvailable(now) {
		this.maybeHalfOpen(now);
		return this.state === "closed" || this.state === "half_open";
	}
	/**
	* Reserve this route for one request. HalfOpen consumes the single permit.
	* @param now - epoch ms.
	*/
	allowProbe(now) {
		this.maybeHalfOpen(now);
		if (this.state === "closed") return {
			allowed: true,
			halfOpen: false
		};
		if (this.state === "half_open") {
			if (this.halfOpenPermit >= 1) return {
				allowed: false,
				halfOpen: true
			};
			this.halfOpenPermit = 1;
			return {
				allowed: true,
				halfOpen: true
			};
		}
		return {
			allowed: false,
			halfOpen: false
		};
	}
	/** Probe succeeded. Two successes close a HalfOpen breaker. */
	recordSuccess() {
		this.releaseProbe();
		this.failures = 0;
		if (this.state !== "half_open") return;
		this.successes += 1;
		if (this.successes >= this.config.successThreshold) this.transitionClosed();
	}
	/**
	* Probe or Closed request failed.
	* @param now - epoch ms used as Open timestamp.
	* @param immediate - open on this hit regardless of `failureThreshold`.
	*/
	recordFailure(now, immediate = false) {
		this.releaseProbe();
		this.failures += 1;
		this.successes = 0;
		if (this.state === "half_open" || immediate || this.failures >= this.config.failureThreshold) this.transitionOpen(now);
	}
	/** Drop the HalfOpen permit without changing health (cancel / abandon). */
	releaseProbe() {
		this.halfOpenPermit = 0;
	}
	maybeHalfOpen(now) {
		if (this.state !== "open" || this.openedAt === null) return;
		if (now - this.openedAt < this.config.timeoutMs) return;
		this.state = "half_open";
		this.successes = 0;
		this.halfOpenPermit = 0;
	}
	transitionOpen(now) {
		this.state = "open";
		this.openedAt = now;
		this.successes = 0;
		this.halfOpenPermit = 0;
	}
	transitionClosed() {
		this.state = "closed";
		this.failures = 0;
		this.successes = 0;
		this.openedAt = null;
		this.halfOpenPermit = 0;
	}
};
/** Per-route breaker map. Missing keys start Closed. */
var CircuitBank = class {
	breakers = /* @__PURE__ */ new Map();
	/**
	* @param config - shared knobs for every route.
	*/
	constructor(config) {
		this.config = config;
	}
	/**
	* Breaker for one provider+model pair.
	* @param key - {@link routeKey}.
	*/
	get(key) {
		const existing = this.breakers.get(key);
		if (existing !== void 0) return existing;
		const created = new CircuitBreaker(this.config);
		this.breakers.set(key, created);
		return created;
	}
	/**
	* Badge rows for the live queue. Touches `isAvailable` so Open can show
	* HalfOpen after the wait without consuming a permit.
	* @param queue - ordered routes.
	* @param now - epoch ms.
	*/
	health(queue, now) {
		return queue.map((route) => {
			const breaker = this.get(routeKey(route));
			breaker.isAvailable(now);
			const snap = breaker.snapshot();
			return {
				provider: route.provider,
				model: route.model,
				state: snap.state,
				failures: snap.failures
			};
		});
	}
};
/**
* First Closed route, else first HalfOpen with a free permit. Never sticky.
* @param queue - P1…Pn.
* @param bank - per-route breakers.
* @param now - epoch ms.
* @param skip - route key to ignore (the attempt that just failed).
*/
function pickFirstAvailable(queue, bank, now, skip) {
	for (let index = 0; index < queue.length; index += 1) {
		const route = queue[index];
		if (route === void 0) continue;
		const key = routeKey(route);
		if (skip !== void 0 && key === skip) continue;
		const breaker = bank.get(key);
		if (!breaker.isAvailable(now)) continue;
		const probe = breaker.allowProbe(now);
		if (!probe.allowed) continue;
		return {
			index,
			route,
			halfOpen: probe.halfOpen
		};
	}
}
/**
* Queue index of the first available route, without consuming a probe permit.
* @param queue - P1…Pn.
* @param bank - per-route breakers.
* @param now - epoch ms.
* @param skip - route key to ignore.
*/
function firstAvailableIndex(queue, bank, now, skip) {
	for (let index = 0; index < queue.length; index += 1) {
		const route = queue[index];
		if (route === void 0) continue;
		const key = routeKey(route);
		if (skip !== void 0 && key === skip) continue;
		if (bank.get(key).isAvailable(now)) return index;
	}
}
/**
* Badge tone for one queue row.
* @param health - host snapshot for this route, if any.
*/
function circuitTone(health) {
	if (health === void 0) return "ok";
	if (health.state === "open") return "open";
	if (health.state === "half_open") return "probe";
	return health.failures > 0 ? "probe" : "ok";
}
/**
* Match a queue route to a health row.
* @param route - queue slot.
* @param circuits - host snapshot.
*/
function healthFor(route, circuits) {
	return circuits.find((row) => row.provider === route.provider && row.model === route.model);
}

//#endregion
//#region src/command.ts
/**
* Parse `/failover` arguments.
* @param rawInput - text after the command name.
*/
function parseFailoverArg(rawInput) {
	const arg = rawInput.trim().toLowerCase();
	if (arg === "" || arg === "status") return { kind: "status" };
	if (arg === "on" || arg === "enable") return { kind: "on" };
	if (arg === "off" || arg === "disable") return { kind: "off" };
	if (arg === "__candidates" || arg === "candidates") return { kind: "candidates" };
	return {
		kind: "error",
		text: "Usage: /failover [on|off|status]"
	};
}

//#endregion
//#region src/config.ts
/** Runtime schema. */
const Config = z.object({
	cooldownMs: z.number().min(0).default(6e4),
	failureThreshold: z.number().min(1).default(2),
	successThreshold: z.number().min(1).default(2),
	immediateCodes: z.array(z.string()).default([
		"AUTH",
		"RATE_LIMIT",
		"NO_ADAPTER"
	])
});
/**
* Apply schema defaults.
* @param config - raw plugin config, possibly partial.
*/
function resolveConfig(config = {}) {
	return Config(config);
}
/** Settings namespace (hyphenated; settings forbids dots). */
const SETTINGS_NAMESPACE = "dsh-failover-queue";
const QueueRouteSchema = z.object({
	provider: z.string(),
	model: z.string(),
	label: z.string().default("")
});
const CircuitHealthSchema = z.object({
	provider: z.string(),
	model: z.string(),
	state: z.string().default("closed"),
	failures: z.number().min(0).default(0)
});
/** Persisted user document. */
const FailoverSettingsSchema = z.object({
	enabled: z.boolean().default(false),
	currentIndex: z.number().step(1).min(0).default(0),
	queue: z.array(QueueRouteSchema).default([]),
	circuits: z.array(CircuitHealthSchema).default([])
});
/** Empty queue, failover off. */
const DEFAULT_SETTINGS = {
	enabled: false,
	currentIndex: 0,
	queue: [],
	circuits: []
};

//#endregion
//#region src/types.ts
/** Marker the `/failover __candidates` handler prefixes onto JSON. */
const CANDIDATES_MARKER = "FAILOVER_CANDIDATES_V1";

//#endregion
//#region src/index.ts
const name = "dsh-failover-queue";
const inject = ["llm"];
/**
* Mount settings, `/failover`, and the request overlay.
* @param ctx - plugin context; requires `llm`.
* @param config - raw plugin config.
*/
function apply(ctx, config = {}) {
	const resolved = resolveConfig(config);
	const bank = new CircuitBank({
		failureThreshold: resolved.failureThreshold,
		successThreshold: resolved.successThreshold,
		timeoutMs: resolved.cooldownMs
	});
	const flights = /* @__PURE__ */ new Map();
	let liveIndex;
	let settings;
	const read = () => {
		const raw = settings?.get() ?? DEFAULT_SETTINGS;
		const queue = dedupeQueue(raw.queue);
		return {
			enabled: raw.enabled,
			queue,
			currentIndex: clampIndex(liveIndex ?? raw.currentIndex, queue.length),
			circuits: bank.health(queue, Date.now())
		};
	};
	const publish = (index) => {
		if (index !== void 0) liveIndex = index;
		const state = read();
		settings?.update({
			currentIndex: state.currentIndex,
			circuits: state.circuits
		});
	};
	ctx.inject(["settings"], (scoped) => {
		settings = scoped.settings.register(SETTINGS_NAMESPACE, FailoverSettingsSchema, { base: DEFAULT_SETTINGS });
		publish();
		return () => {
			settings = void 0;
		};
	});
	ctx.inject(["commands"], (scoped) => {
		const dispose = scoped.commands.register({
			name: "failover",
			description: "Turn P1/P2/P3 failover on or off, or print the queue",
			input: { hint: "[on|off|status]" },
			handler: (invocation) => handleFailoverCommand(ctx, read, settings, invocation.rawInput)
		});
		return () => {
			dispose();
		};
	});
	ctx.on("agent/request", async (payload, next) => {
		const call = await next();
		const state = read();
		if (!state.enabled || state.queue.length === 0) return call;
		const now = Date.now();
		const pick = pickFirstAvailable(state.queue, bank, now);
		if (pick === void 0) return call;
		flights.set(agentKey(payload), {
			key: routeKey(pick.route),
			halfOpen: pick.halfOpen
		});
		publish(pick.index);
		return {
			...call,
			provider: pick.route.provider,
			model: pick.route.model
		};
	});
	ctx.on("agent/request-error", async (payload, next) => {
		const state = read();
		const immediate = state.enabled && shouldFailoverImmediately(payload.failure.code, resolved.immediateCodes);
		let downstream;
		if (!immediate) {
			downstream = await next();
			if (downstream?.kind === "retry") return downstream;
		}
		if (!state.enabled || state.queue.length === 0) return downstream;
		const now = Date.now();
		const id = agentKey(payload);
		const failedKey = flights.get(id)?.key ?? routeKeyFromIndex(state);
		if (failedKey !== void 0) {
			bank.get(failedKey).recordFailure(now, immediate);
			flights.delete(id);
		}
		if (state.queue.length < 2) {
			publish();
			return downstream;
		}
		const nextIndex = firstAvailableIndex(state.queue, bank, now, failedKey);
		if (nextIndex === void 0) {
			publish();
			return downstream;
		}
		publish(nextIndex);
		return { kind: "retry" };
	}, { prepend: true });
	ctx.on("agent/assistant-stream", (payload) => {
		if (payload.frame?.type !== "end") return;
		if (payload.frame.outcome?.kind !== "committed") return;
		if (payload.frame.outcome.eventType !== "assistant/message") return;
		const id = agentKey(payload);
		const flight = flights.get(id);
		if (flight === void 0) return;
		flights.delete(id);
		bank.get(flight.key).recordSuccess();
		publish();
	});
}
function routeKeyFromIndex(state) {
	const route = state.queue[state.currentIndex];
	return route === void 0 ? void 0 : routeKey(route);
}
function agentKey(payload) {
	if (typeof payload !== "object" || payload === null) return "default";
	const agent = payload.agent;
	return typeof agent?.id === "string" && agent.id !== "" ? agent.id : "default";
}
async function handleFailoverCommand(ctx, read, settings, rawInput) {
	const verb = parseFailoverArg(rawInput);
	if (verb.kind === "error") return {
		kind: "error",
		text: verb.text
	};
	if (verb.kind === "candidates") {
		const candidates = await listCandidates(ctx);
		return {
			kind: "success",
			text: `${CANDIDATES_MARKER}\n${JSON.stringify(candidates)}`
		};
	}
	if (verb.kind === "on" || verb.kind === "off") {
		if (settings === void 0) return {
			kind: "error",
			text: "Failover settings are not available yet."
		};
		await settings.update({ enabled: verb.kind === "on" });
		return {
			kind: "success",
			text: verb.kind === "on" ? "Failover on. Requests prefer P1; P2/P3 are backups. Recovered P1 is probed and selected again." : "Failover off. The session model is used as-is."
		};
	}
	const state = read();
	if (state.queue.length === 0) return {
		kind: "success",
		text: state.enabled ? "Failover is on, but the queue is empty. Open the P chip on the composer to add routes." : "Failover is off. Queue is empty."
	};
	const lines = state.queue.map((route, index) => {
		const mark = index === state.currentIndex ? "*" : " ";
		const label = route.label?.trim() || `${route.provider}/${route.model}`;
		const health = state.circuits?.find((row) => row.provider === route.provider && row.model === route.model);
		const badge = health === void 0 || health.state === "closed" ? "" : `  [${health.state}]`;
		return `${mark} P${index + 1}  ${label}  (${route.provider} ${route.model})${badge}`;
	});
	return {
		kind: "success",
		text: `${state.enabled ? "Failover on" : "Failover off"}\n${lines.join("\n")}`
	};
}
async function listCandidates(ctx) {
	const llm = ctx.llm;
	if (llm === void 0) return [];
	const out = [];
	for (const provider of llm.listProviders()) {
		const models = await llm.listModels(provider.id);
		for (const model of models) out.push({
			provider: provider.id,
			providerName: provider.name,
			model: model.id,
			name: model.name
		});
	}
	return out;
}

//#endregion
export { CircuitBank, CircuitBreaker, Config, SETTINGS_NAMESPACE, advanceIndex, apply, circuitTone, clampIndex, dedupeQueue, firstAvailableIndex, healthFor, indexAfterReorder, inject, name, parseFailoverArg, pickFirstAvailable, reorderQueue, resolveConfig, routeDisplay, routeKey };