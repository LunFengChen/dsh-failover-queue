window.__ModuleLoader__.load({ id: "@x1a0f3n9/dsh-failover-queue", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
let react = require("react");
let react_dom = require("react-dom");
let react_jsx_runtime = require("react/jsx-runtime");

//#region src/types.ts
/** Marker the `/failover __candidates` handler prefixes onto JSON. */
const CANDIDATES_MARKER = "FAILOVER_CANDIDATES_V1";

//#endregion
//#region src/candidates.ts
/**
* Parse `/failover __candidates` command text into catalog rows.
* @param text - command success text, possibly including the marker prefix.
* @returns recognized provider+model rows; unknown text is empty.
*/
function candidatesFromText(text) {
	const marker = text.indexOf(CANDIDATES_MARKER);
	if (marker < 0) return [];
	const json = text.slice(marker + CANDIDATES_MARKER.length).trim();
	try {
		const parsed = JSON.parse(json);
		if (!Array.isArray(parsed)) return [];
		return parsed.flatMap((row) => {
			if (typeof row !== "object" || row === null) return [];
			const item = row;
			if (typeof item.provider !== "string" || typeof item.model !== "string") return [];
			return [{
				provider: item.provider,
				providerName: typeof item.providerName === "string" ? item.providerName : item.provider,
				model: item.model,
				name: typeof item.name === "string" ? item.name : item.model
			}];
		});
	} catch {
		return [];
	}
}
/**
* Flatten `session/modelCatalog` into the same provider+model rows.
* @param value - RPC value, or undefined when the call failed.
* @returns one row per model in successful groups.
*/
function candidatesFromCatalog(value) {
	if (typeof value !== "object" || value === null) return [];
	const groups = value.groups;
	if (!Array.isArray(groups)) return [];
	return groups.flatMap((group) => {
		if (typeof group !== "object" || group === null) return [];
		const row = group;
		if (typeof row.id !== "string" || !Array.isArray(row.models)) return [];
		const providerName = typeof row.name === "string" ? row.name : row.id;
		return row.models.flatMap((model) => {
			if (typeof model !== "object" || model === null) return [];
			const item = model;
			if (typeof item.id !== "string") return [];
			return [{
				provider: row.id,
				providerName,
				model: item.id,
				name: typeof item.name === "string" ? item.name : item.id
			}];
		});
	});
}

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
//#region src/client/styles.ts
/** Class names shared between the injected DOM and the stylesheet. */
const CLASS = {
	chip: "dsh-fq-chip",
	chipOn: "dsh-fq-chip-on",
	chipKicker: "dsh-fq-chip-kicker",
	chipPriority: "dsh-fq-chip-priority",
	chipRoute: "dsh-fq-chip-route",
	page: "dsh-fq-page",
	pageIntro: "dsh-fq-page-intro",
	panel: "dsh-fq-panel",
	panelPage: "dsh-fq-panel-page",
	head: "dsh-fq-head",
	title: "dsh-fq-title",
	switchRow: "dsh-fq-switch-row",
	switchCopy: "dsh-fq-switch-copy",
	hint: "dsh-fq-hint",
	list: "dsh-fq-list",
	row: "dsh-fq-row",
	rowActive: "dsh-fq-row-active",
	handle: "dsh-fq-handle",
	badge: "dsh-fq-badge",
	meta: "dsh-fq-meta",
	name: "dsh-fq-name",
	sub: "dsh-fq-sub",
	remove: "dsh-fq-remove",
	addRow: "dsh-fq-add",
	select: "dsh-fq-select",
	empty: "dsh-fq-empty",
	toggle: "dsh-fq-toggle",
	toggleOn: "dsh-fq-toggle-on",
	toggleThumb: "dsh-fq-toggle-thumb"
};
/** One injected stylesheet scoped under `.dsh-fq-*`. */
const STYLE = `
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
  overflow: auto;
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
.dsh-fq-meta { min-width: 0; }
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
.dsh-fq-remove, .dsh-fq-add button {
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #8e8e93);
  cursor: pointer;
  border-radius: 6px;
  height: 24px;
  padding: 0 6px;
}
.dsh-fq-remove:hover, .dsh-fq-add button:hover {
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.08));
}
.dsh-fq-add {
  display: flex;
  gap: 6px;
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
.dsh-fq-select {
  flex: 1;
  min-width: 0;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.12));
  background: var(--dsw-alias-bg-layer-2, transparent);
  color: inherit;
  font-size: 12px;
  padding: 0 8px;
}
`;

//#endregion
//#region src/client/QueuePanel.tsx
/**
* Drag-reorder P1/P2/P3 list plus the auto-failover switch.
* @param props - live snapshot, settings writes, locale.
*/
function QueuePanel({ state, api, t, onClose, embedded = false }) {
	const [pending, setPending] = (0, react.useState)(false);
	const [pick$1, setPick] = (0, react.useState)("");
	const available = (0, react.useMemo)(() => {
		const taken = new Set(state.queue.map(routeKey));
		return state.candidates.filter((row) => !taken.has(routeKey({
			provider: row.provider,
			model: row.model
		})));
	}, [state.candidates, state.queue]);
	const run = (work) => {
		if (pending) return;
		setPending(true);
		work().finally(() => {
			setPending(false);
		});
	};
	const onDrop = (to, event) => {
		event.preventDefault();
		const from = Number(event.dataTransfer.getData("text/plain"));
		if (!Number.isInteger(from) || from === to) return;
		const queue = reorderQueue(state.queue, from, to);
		const currentIndex = indexAfterReorder(state.currentIndex, from, to);
		run(() => api.setQueue(queue, currentIndex));
	};
	const add = () => {
		const [provider, model] = pick$1.split("\0");
		if (provider === void 0 || model === void 0 || provider === "" || model === "") return;
		const candidate = state.candidates.find((row) => row.provider === provider && row.model === model);
		const route = {
			provider,
			model,
			...candidate === void 0 ? {} : { label: candidate.name }
		};
		const queue = [...state.queue, route];
		setPick("");
		run(() => api.setQueue(queue, state.currentIndex));
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: embedded ? `${CLASS.panel} ${CLASS.panelPage}` : CLASS.panel,
		role: embedded ? "region" : "dialog",
		"aria-label": t("panel.title"),
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CLASS.head,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CLASS.title,
					children: t("panel.title")
				}), onClose === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: CLASS.remove,
					onClick: onClose,
					children: t("panel.close")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CLASS.switchRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: CLASS.switchCopy,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("panel.switch") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: state.enabled ? t("panel.switch.on") : t("panel.switch.off") })]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					role: "switch",
					className: `${CLASS.toggle}${state.enabled ? ` ${CLASS.toggleOn}` : ""}`,
					"aria-checked": state.enabled,
					"aria-label": t("panel.switch"),
					disabled: pending,
					onClick: () => {
						run(() => api.setEnabled(!state.enabled));
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: CLASS.toggleThumb })
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: CLASS.hint,
				children: t("panel.hint")
			}),
			state.queue.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: CLASS.empty,
				children: t("panel.empty")
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: CLASS.list,
				children: state.queue.map((route, index) => {
					const active = index === clampIndex(state.currentIndex, state.queue.length);
					const display = routeDisplay(route, state.candidates);
					const title = `${display.provider}/${display.model}`;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: `${CLASS.row}${active ? ` ${CLASS.rowActive}` : ""}`,
						onDragOver: (event) => {
							event.preventDefault();
						},
						onDrop: (event) => {
							onDrop(index, event);
						},
						onClick: () => {
							if (index === state.currentIndex) return;
							run(() => api.setQueue(state.queue, index));
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: CLASS.handle,
								draggable: true,
								title: t("panel.drag"),
								"aria-label": t("panel.drag"),
								onDragStart: (event) => {
									event.dataTransfer.setData("text/plain", String(index));
									event.dataTransfer.effectAllowed = "move";
								},
								onClick: (event) => {
									event.stopPropagation();
								},
								children: "⋮⋮"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: CLASS.badge,
								children: ["P", index + 1]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: CLASS.meta,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: CLASS.name,
									children: [title, active ? ` · ${t("panel.current")}` : ""]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: CLASS.sub,
									children: [
										route.provider,
										" / ",
										route.model
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: CLASS.remove,
								"aria-label": t("panel.remove"),
								onClick: (event) => {
									event.stopPropagation();
									const queue = state.queue.filter((_, item) => item !== index);
									const currentIndex = index < state.currentIndex ? state.currentIndex - 1 : index === state.currentIndex ? clampIndex(state.currentIndex, queue.length) : state.currentIndex;
									run(() => api.setQueue(queue, currentIndex));
								},
								children: "×"
							})
						]
					}, routeKey(route));
				})
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CLASS.addRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
					className: CLASS.select,
					value: pick$1,
					disabled: pending || available.length === 0,
					onChange: (event) => {
						setPick(event.target.value);
					},
					"aria-label": t("panel.add"),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: "",
						children: t("panel.add.placeholder")
					}), available.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
						value: `${row.provider}\0${row.model}`,
						children: [
							row.providerName,
							" / ",
							row.name
						]
					}, `${row.provider}\0${row.model}`))]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: pending || pick$1 === "",
					onClick: add,
					children: t("panel.add")
				})]
			})
		]
	});
}

//#endregion
//#region src/client/FailoverChip.tsx
function sessionOf(props) {
	return props.sessionId ?? props.getSessionId?.() ?? "";
}
function chipCopy(state, t) {
	if (!state.enabled) return {
		title: t("chip.title.off"),
		aria: t("chip.aria.off"),
		slot: void 0,
		route: void 0
	};
	if (state.queue.length === 0) return {
		title: t("chip.empty"),
		aria: t("chip.empty"),
		slot: void 0,
		route: t("chip.empty")
	};
	const slot = clampIndex(state.currentIndex, state.queue.length) + 1;
	const current = state.queue[slot - 1];
	if (current === void 0) return {
		title: t("chip.empty"),
		aria: t("chip.empty"),
		slot: void 0,
		route: t("chip.empty")
	};
	const display = routeDisplay(current, state.candidates);
	const params = {
		slot,
		provider: display.provider,
		model: display.model
	};
	return {
		title: t("chip.on", params),
		aria: t("chip.aria.on", params),
		slot,
		route: `${display.provider}/${display.model}`
	};
}
/**
* Composer chip: shows failover status and opens the drag panel.
* @param props - composed slot props.
*/
function FailoverChip(props) {
	const { useFailover, api, loadCandidates, t } = props;
	const state = useFailover((snapshot$1) => snapshot$1);
	const sessionId = sessionOf(props);
	const [open, setOpen] = (0, react.useState)(false);
	const rootRef = (0, react.useRef)(null);
	const panelRef = (0, react.useRef)(null);
	const [pos, setPos] = (0, react.useState)(null);
	const copy = chipCopy(state, t);
	(0, react.useEffect)(() => {
		loadCandidates(sessionId);
	}, [loadCandidates, sessionId]);
	(0, react.useLayoutEffect)(() => {
		if (!open) return;
		const place = () => {
			const trigger = rootRef.current;
			const panel = panelRef.current;
			if (trigger === null || panel === null) return;
			const rect = trigger.getBoundingClientRect();
			const width = panel.offsetWidth;
			const height = panel.offsetHeight;
			const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
			const above = rect.top - 8 - height;
			setPos({
				left,
				top: above >= 8 ? above : Math.min(rect.bottom + 8, window.innerHeight - height - 8)
			});
		};
		place();
		window.addEventListener("resize", place);
		return () => {
			window.removeEventListener("resize", place);
		};
	}, [
		open,
		state.queue.length,
		state.enabled,
		copy.route
	]);
	(0, react.useEffect)(() => {
		if (!open) return;
		const close = (event) => {
			if (rootRef.current?.contains(event.target) === true) return;
			if (panelRef.current?.contains(event.target) === true) return;
			setOpen(false);
		};
		const onKey = (event) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", close);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", close);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		ref: rootRef,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			className: `${CLASS.chip}${state.enabled ? ` ${CLASS.chipOn}` : ""}`,
			"aria-pressed": state.enabled,
			"aria-expanded": open,
			"aria-label": copy.aria,
			title: copy.title,
			onMouseDown: (event) => {
				event.preventDefault();
			},
			onClick: () => {
				setOpen((value) => !value);
			},
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: CLASS.chipKicker,
				children: t("chip.kicker")
			}), copy.slot === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: CLASS.chipRoute,
				children: copy.route ?? t("chip.off")
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: CLASS.chipPriority,
				children: ["P", copy.slot]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: CLASS.chipRoute,
				children: copy.route
			})] })]
		}), open && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			ref: panelRef,
			style: {
				...pos,
				position: "fixed",
				zIndex: 1100
			},
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QueuePanel, {
				state,
				api,
				t,
				onClose: () => {
					setOpen(false);
				}
			})
		}), document.body)]
	});
}
/**
* Settings left-nav page: the same queue editor, in document flow.
* @param props - composed slot props.
*/
function FailoverSettingsCard(props) {
	const { useFailover, api, loadCandidates, t } = props;
	const state = useFailover((snapshot$1) => snapshot$1);
	const sessionId = sessionOf(props);
	(0, react.useEffect)(() => {
		loadCandidates(sessionId);
	}, [loadCandidates, sessionId]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: CLASS.page,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: CLASS.pageIntro,
			children: t("settings.intro")
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QueuePanel, {
			state,
			api,
			t,
			embedded: true
		})]
	});
}

//#endregion
//#region src/client/locales.ts
/** Locale bundles for the failover chip and drag panel. */
const NS = "failover";
const zh = {
	"chip.kicker": "故障转移：",
	"chip.off": "关",
	"chip.empty": "无队列",
	"chip.on": "故障转移：P{slot} {provider}/{model}",
	"chip.aria.on": "故障转移已开启，当前 P{slot} {provider}/{model}，点击打开队列",
	"chip.aria.off": "故障转移已关闭，点击打开队列",
	"chip.title.off": "自动故障转移关闭。点进去开启并编排队列。",
	"panel.title": "故障转移队列",
	"panel.switch": "自动故障转移",
	"panel.switch.on": "失败按 P1 → P2 → P3 切换",
	"panel.switch.off": "只用当前会话模型，不跨路由",
	"panel.empty": "队列是空的。从下面加一条路由，P1 就是主供应商。",
	"panel.add": "加入队列",
	"panel.add.placeholder": "选择一条路由…",
	"panel.remove": "移除",
	"panel.drag": "拖动改优先级",
	"panel.current": "当前",
	"panel.close": "关闭",
	"panel.hint": "拖动左侧手柄调整 P1/P2/P3。点一行设为当前。",
	"settings.tab": "故障转移",
	"settings.intro": "编排 P1 / P2 / P3。开启后请求走队列当前档，不看会话里随手选的模型。"
};
const en = {
	"chip.kicker": "Failover: ",
	"chip.off": "Off",
	"chip.empty": "empty",
	"chip.on": "Failover: P{slot} {provider}/{model}",
	"chip.aria.on": "Failover on, current P{slot} {provider}/{model}, click to open the queue",
	"chip.aria.off": "Failover off, click to open the queue",
	"chip.title.off": "Auto failover is off. Click to enable and edit the queue.",
	"panel.title": "Failover queue",
	"panel.switch": "Auto failover",
	"panel.switch.on": "On failure, switch P1 → P2 → P3",
	"panel.switch.off": "Use the session model only",
	"panel.empty": "Queue is empty. Add a route below. P1 is the primary.",
	"panel.add": "Add to queue",
	"panel.add.placeholder": "Pick a route…",
	"panel.remove": "Remove",
	"panel.drag": "Drag to reorder",
	"panel.current": "current",
	"panel.close": "Close",
	"panel.hint": "Drag the handle to change P1/P2/P3. Click a row to make it current.",
	"settings.tab": "Failover",
	"settings.intro": "Arrange P1 / P2 / P3. While on, requests use the active queue slot, not the session picker."
};

//#endregion
//#region ../deepseek-harness/vendor/cosmokit/src/misc.ts
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true for non-array object values. */
function isPlainObject(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}

//#endregion
//#region ../deepseek-harness/vendor/cosmokit/src/types.ts
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value$1) => is(type, value$1);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
let Binary;
(function(_Binary) {
	_Binary.is = isArrayBufferLike;
	_Binary.isSource = isArrayBufferSource;
	function fromSource(source) {
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		else return source;
	}
	_Binary.fromSource = fromSource;
	function toBase64(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
		let binary = "";
		const bytes = new Uint8Array(source);
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	}
	_Binary.toBase64 = toBase64;
	function fromBase64(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
		return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
	}
	_Binary.fromBase64 = fromBase64;
	function toHex(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
		return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	_Binary.toHex = toHex;
	function fromHex(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
		const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
		const buffer = [];
		for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
		return Uint8Array.from(buffer).buffer;
	}
	_Binary.fromHex = fromHex;
})(Binary || (Binary = {}));
/** Decode a base64 string into binary data. */
const base64ToArrayBuffer = Binary.fromBase64;
/** Encode binary data as base64. */
const arrayBufferToBase64 = Binary.toBase64;
/** Decode a hex string into binary data. */
const hexToArrayBuffer = Binary.fromHex;
/** Encode binary data as hex. */
const arrayBufferToHex = Binary.toHex;
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result$1 = [];
		refs.set(source, result$1);
		source.forEach((value, index) => {
			result$1[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result$1;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
function deepEqual(a, b, strict) {
	if (a === b) return true;
	if (!strict && isNullable(a) && isNullable(b)) return true;
	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;
	if (!a || !b) return false;
	function check(test, then) {
		return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
	}
	return check(Array.isArray, (a$1, b$1) => a$1.length === b$1.length && a$1.every((item, index) => deepEqual(item, b$1[index]))) ?? check(is("Date"), (a$1, b$1) => a$1.valueOf() === b$1.valueOf()) ?? check(is("RegExp"), (a$1, b$1) => a$1.source === b$1.source && a$1.flags === b$1.flags) ?? check(isArrayBufferLike, (a$1, b$1) => {
		if (a$1.byteLength !== b$1.byteLength) return false;
		const viewA = new Uint8Array(a$1);
		const viewB = new Uint8Array(b$1);
		for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
		return true;
	}) ?? Object.keys({
		...a,
		...b
	}).every((key) => deepEqual(a[key], b[key], strict));
}

//#endregion
//#region ../deepseek-harness/vendor/cosmokit/src/time.ts
let Time;
(function(_Time) {
	_Time.millisecond = 1;
	const second = _Time.second = 1e3;
	const minute = _Time.minute = second * 60;
	const hour = _Time.hour = minute * 60;
	const day = _Time.day = hour * 24;
	const week = _Time.week = day * 7;
	let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	function setTimezoneOffset(offset) {
		timezoneOffset = offset;
	}
	_Time.setTimezoneOffset = setTimezoneOffset;
	function getTimezoneOffset() {
		return timezoneOffset;
	}
	_Time.getTimezoneOffset = getTimezoneOffset;
	function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
		if (typeof date === "number") date = new Date(date);
		if (offset === void 0) offset = timezoneOffset;
		return Math.floor((date.valueOf() / minute - offset) / 1440);
	}
	_Time.getDateNumber = getDateNumber;
	function fromDateNumber(value, offset) {
		const date = new Date(value * day);
		if (offset === void 0) offset = timezoneOffset;
		return new Date(+date + offset * minute);
	}
	_Time.fromDateNumber = fromDateNumber;
	const numeric = /\d+(?:\.\d+)?/.source;
	const timeRegExp = /* @__PURE__ */ new RegExp(`^${[
		"w(?:eek(?:s)?)?",
		"d(?:ay(?:s)?)?",
		"h(?:our(?:s)?)?",
		"m(?:in(?:ute)?(?:s)?)?",
		"s(?:ec(?:ond)?(?:s)?)?"
	].map((unit) => `(${numeric}${unit})?`).join("")}$`);
	function parseTime(source) {
		const capture = timeRegExp.exec(source);
		if (!capture) return 0;
		return (parseFloat(capture[1]) * week || 0) + (parseFloat(capture[2]) * day || 0) + (parseFloat(capture[3]) * hour || 0) + (parseFloat(capture[4]) * minute || 0) + (parseFloat(capture[5]) * second || 0);
	}
	_Time.parseTime = parseTime;
	function parseDate(date) {
		const parsed = parseTime(date);
		if (parsed) date = Date.now() + parsed;
		else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
		else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
		return date ? new Date(date) : /* @__PURE__ */ new Date();
	}
	_Time.parseDate = parseDate;
	function format(ms) {
		const abs = Math.abs(ms);
		if (abs >= day - hour / 2) return Math.round(ms / day) + "d";
		else if (abs >= hour - minute / 2) return Math.round(ms / hour) + "h";
		else if (abs >= minute - second / 2) return Math.round(ms / minute) + "m";
		else if (abs >= second) return Math.round(ms / second) + "s";
		return ms + "ms";
	}
	_Time.format = format;
	function toDigits(source, length = 2) {
		return source.toString().padStart(length, "0");
	}
	_Time.toDigits = toDigits;
	function template(template$1, time = /* @__PURE__ */ new Date()) {
		return template$1.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
	}
	_Time.template = template;
})(Time || (Time = {}));

//#endregion
//#region ../deepseek-harness/vendor/schemastery/src/index.ts
const kSchema = Symbol.for("schemastery");
const kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError];
	}
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
const Schema = function(options) {
	const schema = function(data, options$1 = {}) {
		return Schema.resolve(data, schema, options$1)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options$1) => new Schema(options$1));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options$1 = refs[key];
			options$1.sKey = getRef(options$1.sKey);
			options$1.inner = getRef(options$1.inner);
			options$1.list = options$1.list && options$1.list.map(getRef);
			options$1.dict = options$1.dict && mapValues(options$1.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
	const schema = Schema(this);
	const desc = mergeDesc(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner(data))) return getInner(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner(data)) return getInner(data);
		return extractKeys(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema.prototype.extra = function extra(key, value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.deprecated = function deprecated() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema.prototype.experimental = function experimental() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
	const schema = Schema(this);
	const pattern$1 = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern: pattern$1
	};
	return schema;
};
Schema.prototype.simplify = function simplify(value) {
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value$1, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value$1) : value$1;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema.prototype.toString = function toString(inline) {
	return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role$1, extra) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		role: role$1,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema.prototype, { [key](value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
const resolvers = {};
Schema.extend = function extend(type, resolve) {
	resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers[schema.type];
	if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema.from = function from(source) {
	if (isNullable(source)) return Schema.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema.const(source).required();
	else if (source[kSchema]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema.string().required();
		case Number: return Schema.number().required();
		case Boolean: return Schema.boolean().required();
		case Function: return Schema.function().required();
		default: return Schema.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema.natural = function natural() {
	return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
	return Schema.number().step(.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
	return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
		const date$1 = new Date(value);
		if (isNaN(+date$1)) throw new ValidationError(`invalid date "${value}"`, options);
		return date$1;
	}, true)]);
};
Schema.regExp = function regExp(flag = "") {
	return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError(e.message, options);
		}
	}, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
	return Schema.union([
		Schema.is(ArrayBuffer),
		Schema.is(SharedArrayBuffer),
		Schema.transform(Schema.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema.transform(Schema.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)] : []
	]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
	}
	return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
	return [data];
});
Schema.extend("never", (data, _, options) => {
	throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange(data.length, meta, "string length", options);
	return [data];
});
function decimalShift(data, digits) {
	const str = data.toString();
	if (str.includes("e")) return data * Math.pow(10, digits);
	const index = str.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str.slice(index + 1);
	const integer = str.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
	checkWithinRange(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError(`expected ${constructor} but got ${data}`, options);
	}
});
function property(data, key, schema, options) {
	try {
		const [value, adapted] = Schema.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.default;
	}
}
Schema.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge(result, data);
	return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge(result ??= {}, value);
		else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject(data)) merge(result, data);
	return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters = {};
function defineMethod(name, keys, format) {
	formatters[name] = format;
	Object.assign(Schema, { [name](...args) {
		const schema = new Schema({ type: name });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema.string();
					break;
				case "inner":
					schema.inner = Schema.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key$1 in args[index]) {
						if (typeof args[index][key$1] !== "number") continue;
						schema.bits[key$1] = args[index][key$1];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name === "object" || name === "dict") schema.meta.default = {};
		else if (name === "array" || name === "tuple") schema.meta.default = [];
		else if (name === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));
var src_default = Schema;

//#endregion
//#region src/config.ts
/** Runtime schema. */
const Config = src_default.object({
	cooldownMs: src_default.number().min(0).default(6e4),
	immediateCodes: src_default.array(src_default.string()).default([
		"AUTH",
		"RATE_LIMIT",
		"NO_ADAPTER"
	])
});
const QueueRouteSchema = src_default.object({
	provider: src_default.string(),
	model: src_default.string(),
	label: src_default.string().default("")
});
/** Persisted user document. */
const FailoverSettingsSchema = src_default.object({
	enabled: src_default.boolean().default(false),
	currentIndex: src_default.number().step(1).min(0).default(0),
	queue: src_default.array(QueueRouteSchema).default([])
});
/** Empty queue, failover off. */
const DEFAULT_SETTINGS = {
	enabled: false,
	currentIndex: 0,
	queue: []
};

//#endregion
//#region src/client/state.ts
const listeners = /* @__PURE__ */ new Set();
let snapshot = {
	...DEFAULT_SETTINGS,
	candidates: []
};
function publish(next) {
	snapshot = next;
	for (const listener of [...listeners]) listener();
}
/** Bare observable the slot renderer binds to `useFailover`. */
const failoverSource = {
	subscribe(listener) {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	getSnapshot() {
		return snapshot;
	}
};
/**
* Replace settings fields, keep candidates.
* @param settings - persisted document.
*/
function replaceSettings(settings) {
	const queue = dedupeQueue(settings.queue);
	publish({
		enabled: settings.enabled,
		queue,
		currentIndex: clampIndex(settings.currentIndex, queue.length),
		candidates: snapshot.candidates
	});
}
/**
* Replace the add-dropdown catalog.
* @param candidates - advertised provider+model rows.
*/
function replaceCandidates(candidates) {
	publish({
		...snapshot,
		candidates
	});
}

//#endregion
//#region src/client/index.ts
/** Required services for the composer chip and settings page. */
const inject = [
	"slots",
	"locale",
	"settingsScope",
	"remote",
	"remote.commands",
	"remote.session"
];
function currentSessionId(ctx, sessionId) {
	if (typeof sessionId === "string" && sessionId !== "") return sessionId;
	const current = ctx.get("sessions")?.list?.getSnapshot?.().current;
	return typeof current === "string" ? current : "";
}
function settingsFromUnknown(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const record = value;
	if (typeof record.enabled !== "boolean") return void 0;
	if (typeof record.currentIndex !== "number") return void 0;
	if (!Array.isArray(record.queue)) return void 0;
	const queue = record.queue.flatMap((row) => {
		if (typeof row !== "object" || row === null) return [];
		const item = row;
		if (typeof item.provider !== "string" || typeof item.model !== "string") return [];
		return [{
			provider: item.provider,
			model: item.model,
			...typeof item.label === "string" ? { label: item.label } : {}
		}];
	});
	return {
		enabled: record.enabled,
		currentIndex: record.currentIndex,
		queue
	};
}
/**
* Register dictionaries, the composer chip, and the Settings left-nav page.
* @param ctx - browser plugin context.
*/
function apply(ctx) {
	const client = ctx;
	const scope = client.settingsScope.bind({ namespace: "dsh-failover-queue" });
	const pull = () => {
		const value = settingsFromUnknown(scope.getSnapshot().value);
		if (value !== void 0) replaceSettings(value);
	};
	pull();
	const api = {
		setEnabled: async (enabled) => {
			await scope.set("enabled", enabled);
		},
		setQueue: async (queue, currentIndex) => {
			await scope.set("queue", queue);
			await scope.set("currentIndex", currentIndex);
		}
	};
	const loadCandidates = async (sessionId) => {
		const catalog = await client.remote.session?.modelCatalog();
		if (catalog?.ok) {
			const rows = candidatesFromCatalog(catalog.value);
			if (rows.length > 0) {
				replaceCandidates(rows);
				return;
			}
		}
		if (sessionId === "") return;
		const result = await client.remote.commands.execute(sessionId, "/failover __candidates", []);
		if (!result.ok) return;
		const text = typeof result.value === "string" ? result.value : typeof result.value?.text === "string" ? result.value.text : "";
		if (text === "") return;
		replaceCandidates(candidatesFromText(text));
	};
	const injected = (sessionId) => ({
		hooks: { failover: failoverSource },
		api,
		loadCandidates,
		getSessionId: () => currentSessionId(ctx, sessionId)
	});
	client.effect(() => {
		const style = document.createElement("style");
		style.dataset.plugin = "dsh-failover-queue";
		style.textContent = STYLE;
		document.head.appendChild(style);
		return () => {
			style.remove();
		};
	}, "dsh-failover-queue: styles");
	client.effect(() => client.locale.register(NS, {
		zh,
		en
	}), "dsh-failover-queue: dictionaries");
	client.effect(() => scope.subscribe(pull), "dsh-failover-queue: settings");
	client.slots.inject("conversation.input.right", () => client.slots.register({
		name: "conversation.input.right",
		id: "dsh-failover-queue",
		order: 40,
		locale: NS,
		inject: injected
	}, FailoverChip));
	client.slots.inject("settings.section", () => client.slots.register({
		name: "settings.section",
		id: "failover",
		order: 17,
		locale: NS,
		label: () => client.locale.bind(NS)("settings.tab"),
		inject: injected
	}, FailoverSettingsCard));
}

//#endregion
exports.apply = apply;
exports.inject = inject;
return module.exports; } });
//# sourceMappingURL=client.js.map