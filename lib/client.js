window.__ModuleLoader__.load({ id: "@x1a0f3n9/dsh-failover-queue", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) {
				__defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
		}
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let react = require("react");
let react_dom = require("react-dom");
let react_jsx_runtime = require("react/jsx-runtime");
let __deepseek_ai_schemastery = require("@deepseek-ai/schemastery");
__deepseek_ai_schemastery = __toESM(__deepseek_ai_schemastery);

//#region src/types.ts
/** Marker the `/failover __candidates` handler prefixes onto JSON. */
const CANDIDATES_MARKER = "FAILOVER_CANDIDATES_V1";

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
	panel: "dsh-fq-panel",
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
function QueuePanel({ state, api, t, onClose }) {
	const [pending, setPending] = (0, react.useState)(false);
	const [pick, setPick] = (0, react.useState)("");
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
		const [provider, model] = pick.split("\0");
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
		className: CLASS.panel,
		role: "dialog",
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
					value: pick,
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
					disabled: pending || pick === "",
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
	const state = useFailover();
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
* Settings tab: the same queue without the composer chip.
* @param props - composed slot props.
*/
function FailoverSettingsCard(props) {
	const { useFailover, api, loadCandidates, t } = props;
	const state = useFailover();
	const sessionId = sessionOf(props);
	(0, react.useEffect)(() => {
		loadCandidates(sessionId);
	}, [loadCandidates, sessionId]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QueuePanel, {
		state,
		api,
		t
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
	"settings.tab": "故障转移"
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
	"settings.tab": "Failover"
};

//#endregion
//#region src/config.ts
/** Runtime schema. */
const Config = __deepseek_ai_schemastery.default.object({
	cooldownMs: __deepseek_ai_schemastery.default.number().min(0).default(6e4),
	immediateCodes: __deepseek_ai_schemastery.default.array(__deepseek_ai_schemastery.default.string()).default([
		"AUTH",
		"RATE_LIMIT",
		"NO_ADAPTER"
	])
});
const QueueRouteSchema = __deepseek_ai_schemastery.default.object({
	provider: __deepseek_ai_schemastery.default.string(),
	model: __deepseek_ai_schemastery.default.string(),
	label: __deepseek_ai_schemastery.default.string().default("")
});
/** Persisted user document. */
const FailoverSettingsSchema = __deepseek_ai_schemastery.default.object({
	enabled: __deepseek_ai_schemastery.default.boolean().default(false),
	currentIndex: __deepseek_ai_schemastery.default.number().step(1).min(0).default(0),
	queue: __deepseek_ai_schemastery.default.array(QueueRouteSchema).default([])
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
/** Required services for the composer chip and settings card. */
const inject = [
	"slots",
	"locale",
	"settingsScope",
	"remote",
	"remote.commands"
];
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
* Register dictionaries, the composer chip, and the settings tab.
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
		if (sessionId === "") return;
		const result = await client.remote.commands.execute(sessionId, "/failover __candidates", []);
		if (!result.ok) return;
		const text = typeof result.value === "string" ? result.value : typeof result.value?.text === "string" ? result.value.text : "";
		if (text === "") return;
		replaceCandidates(candidatesFromText(text));
	};
	const injected = () => ({
		hooks: { failover: failoverSource },
		api,
		loadCandidates,
		getSessionId: () => client.sessions?.list.getSnapshot().current ?? ""
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
	client.slots.inject("settings.plugins.tab", () => client.slots.register({
		name: "settings.plugins.tab",
		id: "failover",
		order: 80,
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