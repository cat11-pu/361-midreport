import assert from "node:assert";
import { sortOf, midOf } from "../mid.js";
import { step, close } from "../midrun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { readings: [], settled: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "report", metric: 1, source: "a", value: 5 }],
  bad_metric_code: "E_BAD_METRIC", bad_source_code: "E_BAD_SOURCE",
  bad_value_code: "E_BAD_VALUE", dup_code: "E_DUP_REPORT",
  enough_code: "E_NOT_ENOUGH", done_code: "E_DONE",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("sortOf returns a list", () => {
  assert.ok(Array.isArray(sortOf([["a", 1], ["b", 2]])));
});

check("midOf returns a number", () => {
  assert.strictEqual(typeof midOf([1, 2, 3]), "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
