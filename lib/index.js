import z from "@deepseek-ai/schemastery";

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
/** Persisted user document. */
const FailoverSettingsSchema = z.object({
	enabled: z.boolean().default(false),
	currentIndex: z.number().step(1).min(0).default(0),
	queue: z.array(QueueRouteSchema).default([])
});
/** Empty queue, failover off. */
const DEFAULT_SETTINGS = {
	enabled: false,
	currentIndex: 0,
	queue: []
};

//#endregion
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
	const cooledUntil = /* @__PURE__ */ new Map();
	let liveIndex;
	let settings;
	const read = () => {
		const raw = settings?.get() ?? DEFAULT_SETTINGS;
		const queue = dedupeQueue(raw.queue);
		return {
			enabled: raw.enabled,
			queue,
			currentIndex: clampIndex(liveIndex ?? raw.currentIndex, queue.length)
		};
	};
	const writeIndex = (index) => {
		liveIndex = index;
		settings?.update({ currentIndex: index });
	};
	ctx.inject(["settings"], (scoped) => {
		settings = scoped.settings.register(SETTINGS_NAMESPACE, FailoverSettingsSchema, { base: DEFAULT_SETTINGS });
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
	ctx.on("agent/request", async (_payload, next) => {
		const call = await next();
		const state = read();
		if (!state.enabled || state.queue.length === 0) return call;
		const route = state.queue[state.currentIndex];
		if (route === void 0) return call;
		return {
			...call,
			provider: route.provider,
			model: route.model
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
		if (!state.enabled || state.queue.length < 2) return downstream;
		const now = Date.now();
		const failed = state.queue[state.currentIndex];
		if (failed !== void 0) cooledUntil.set(routeKey(failed), now + resolved.cooldownMs);
		const nextIndex = advanceIndex(state.queue, state.currentIndex, (route) => (cooledUntil.get(routeKey(route)) ?? 0) > now);
		if (nextIndex === void 0) return downstream;
		writeIndex(nextIndex);
		return { kind: "retry" };
	});
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
			text: verb.kind === "on" ? "Failover on. Requests use P1, then P2, then P3 on failure." : "Failover off. The session model is used as-is."
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
		return `${mark} P${index + 1}  ${label}  (${route.provider} ${route.model})`;
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
export { Config, SETTINGS_NAMESPACE, advanceIndex, apply, clampIndex, dedupeQueue, indexAfterReorder, inject, name, parseFailoverArg, reorderQueue, resolveConfig, routeKey };