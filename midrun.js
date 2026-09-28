// midrun.js：按共用处理预算处理事件，用尽连着压账，收尾不限预算补账
import { sortOf, midOf } from "./mid.js";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function codesOf(spec) {
  return {
    badEvent: spec.event_error_code || "E_BAD_EVENT",
    badMetric: spec.bad_metric_code || "E_BAD_METRIC",
    badSource: spec.bad_source_code || "E_BAD_SOURCE",
    badValue: spec.bad_value_code || "E_BAD_VALUE",
    dup: spec.dup_code || "E_DUP_REPORT",
    noMetric: spec.no_metric_code || "E_NO_METRIC",
    notEnough: spec.enough_code || "E_NOT_ENOUGH",
    done: spec.done_code || "E_DONE"
  };
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

// 结构与字段校验，全部通过后归一化成紧凑元组
function normalize(event, codes) {
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    fail(codes.badEvent);
  }
  if (event.kind !== "report" && event.kind !== "settle") fail(codes.badEvent);
  if (!isPositiveInt(event.metric)) fail(codes.badMetric);
  if (event.kind === "report") {
    if (typeof event.source !== "string" || event.source.length === 0) fail(codes.badSource);
    if (!Number.isInteger(event.value)) fail(codes.badValue);
    return ["report", event.metric, event.source, event.value];
  }
  return ["settle", event.metric];
}

function cloneState(state) {
  const source = state || {};
  return {
    readings: (source.readings || []).map(function (row) {
      return [row[0], row[1].map(function (cell) { return [cell[0], cell[1]]; })];
    }),
    settled: (source.settled || []).map(function (row) { return [row[0], row[1]]; }),
    ledger: (source.ledger || []).map(function (tuple) { return tuple.slice(); }),
    applied: (source.applied || []).map(function (tuple) { return tuple.slice(); })
  };
}

function findMetric(readings, metric) {
  for (let i = 0; i < readings.length; i += 1) {
    if (readings[i][0] === metric) return i;
  }
  return -1;
}

function applyTuple(state, tuple, codes) {
  const key = JSON.stringify(tuple);
  if (state.applied.some(function (done) { return JSON.stringify(done) === key; })) return false;
  if (tuple[0] === "report") {
    const metric = tuple[1];
    const source = tuple[2];
    const value = tuple[3];
    let index = findMetric(state.readings, metric);
    if (index === -1) {
      index = state.readings.length;
      for (let i = 0; i < state.readings.length; i += 1) {
        if (metric < state.readings[i][0]) { index = i; break; }
      }
      state.readings.splice(index, 0, [metric, []]);
    }
    const row = state.readings[index];
    if (row[1].some(function (cell) { return cell[0] === source; })) fail(codes.dup);
    row[1].push([source, value]);
    row[1] = sortOf(row[1]);
  } else {
    const metric = tuple[1];
    const index = findMetric(state.readings, metric);
    if (index === -1) fail(codes.noMetric);
    const cells = state.readings[index][1];
    if (cells.length < 3) fail(codes.notEnough);
    if (state.settled.some(function (row) { return row[0] === metric; })) fail(codes.done);
    state.settled.push([metric, midOf(cells.map(function (cell) { return cell[1]; }))]);
  }
  state.applied.push(tuple);
  return true;
}

// 先清上一轮压账，再按预算处理新事件；用尽后剩余事件连着压账
export function step(spec) {
  const codes = codesOf(spec);
  const state = cloneState(spec.state);
  const events = spec.events || [];
  let budget = Number.isInteger(spec.budget) ? spec.budget : 0;

  const backlog = state.ledger;
  state.ledger = [];
  let served = 0;

  for (const raw of backlog) {
    if (budget > 0) {
      if (applyTuple(state, raw, codes)) served += 1;
      budget -= 1;
    } else {
      state.ledger.push(raw);
    }
  }

  for (const event of events) {
    const tuple = normalize(event, codes);
    const key = JSON.stringify(tuple);
    const already = state.applied.some(function (done) {
      return JSON.stringify(done) === key;
    });
    if (already) continue;
    if (budget > 0) {
      applyTuple(state, tuple, codes);
      served += 1;
      budget -= 1;
    } else {
      state.ledger.push(tuple);
    }
  }

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger,
    judged: served,
    judged_bound: events.length
  };
}

// 不限预算把账做完
export function close(spec) {
  const codes = codesOf(spec);
  const state = cloneState(spec.state);
  let catchup = 0;
  while (state.ledger.length > 0) {
    const tuple = state.ledger.shift();
    if (applyTuple(state, tuple, codes)) catchup += 1;
  }
  return { state: state, catchup: catchup };
}
