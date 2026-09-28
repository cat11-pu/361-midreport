// midrun.js：按处理预算处理并留账
import { sortOf, midOf } from "./mid.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function cloneOf(state) {
  return JSON.parse(JSON.stringify(state));
}

function canonicalOf(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    fail("E_BAD_EVENT", "事件结构不合法");
  }
  if (event.kind !== "report" && event.kind !== "settle") {
    fail("E_BAD_EVENT", "事件结构不合法");
  }
  if (!Number.isInteger(event.metric) || event.metric <= 0) {
    fail("E_BAD_METRIC", "指标号不是正整数");
  }
  if (event.kind === "report") {
    if (typeof event.source !== "string" || event.source === "") {
      fail("E_BAD_SOURCE", "来源名为空");
    }
    if (!Number.isInteger(event.value)) {
      fail("E_BAD_VALUE", "读数不是整数");
    }
    return ["report", event.metric, event.source, event.value];
  }
  return ["settle", event.metric];
}

function commit(state, tuple) {
  if (tuple[0] === "report") {
    const metric = tuple[1];
    let row = null;
    for (const entry of state.readings) {
      if (entry[0] === metric) { row = entry; break; }
    }
    if (row) {
      for (const cell of row[1]) {
        if (cell[0] === tuple[2]) fail("E_DUP_REPORT", "同一来源对同一指标重复上报");
      }
      row[1] = sortOf(row[1].concat([[tuple[2], tuple[3]]]));
    } else {
      state.readings.push([metric, [[tuple[2], tuple[3]]]]);
      state.readings.sort(function (left, right) { return left[0] - right[0]; });
    }
    return;
  }
  const metric = tuple[1];
  let row = null;
  for (const entry of state.readings) {
    if (entry[0] === metric) { row = entry; break; }
  }
  if (!row) fail("E_NO_METRIC", "裁决的指标没有读数");
  if (row[1].length < 3) fail("E_NOT_ENOUGH", "来源不足三个");
  for (const done of state.settled) {
    if (done[0] === metric) fail("E_DONE", "同一指标重复裁决");
  }
  const values = row[1].map(function (cell) { return cell[1]; });
  state.settled.push([metric, midOf(values)]);
  state.settled.sort(function (left, right) { return left[0] - right[0]; });
}

function runCore(spec, budget) {
  const state = cloneOf(spec.state);
  const ledger = state.ledger;
  const appliedKeys = new Set(state.applied.map(function (tuple) { return JSON.stringify(tuple); }));
  const incoming = (spec.events || []).map(canonicalOf);
  const initialLedger = ledger.length;
  let served = 0;
  let worked = 0;

  while (ledger.length > 0) {
    worked += 1;
    const tuple = ledger[0];
    if (appliedKeys.has(JSON.stringify(tuple))) {
      ledger.shift();
      continue;
    }
    if (served >= budget) break;
    ledger.shift();
    commit(state, tuple);
    appliedKeys.add(JSON.stringify(tuple));
    state.applied.push(tuple);
    served += 1;
  }

  for (const tuple of incoming) {
    worked += 1;
    const key = JSON.stringify(tuple);
    if (appliedKeys.has(key)) continue;
    if (served >= budget) {
      ledger.push(tuple);
      continue;
    }
    commit(state, tuple);
    appliedKeys.add(key);
    state.applied.push(tuple);
    served += 1;
  }

  return { state: state, served: served, worked: worked, bound: initialLedger + incoming.length };
}

export function step(spec) {
  const raw = Number(spec.budget);
  const budget = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  const result = runCore(spec, budget);
  return {
    state: result.state,
    served: result.served,
    ledger_before: result.state.ledger.length,
    ledger: result.state.ledger,
    judged: result.worked,
    judged_bound: result.bound
  };
}

export function close(spec) {
  const result = runCore(Object.assign({}, spec, { events: [] }), Number.MAX_SAFE_INTEGER);
  return { state: result.state, catchup: result.served };
}
