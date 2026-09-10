import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/core/store.mjs";

test("queue checkpoints commit together and roll back on serialization failure", () => {
  const store = new Store(":memory:");
  try {
    store.setMany({jobs:["old"],usage:10,currentBatchId:"old"});
    const circular = {}; circular.self = circular;
    assert.throws(() => store.setMany({jobs:["new"],usage:circular,currentBatchId:"new"}));
    assert.deepEqual(store.get("jobs"),["old"]);
    assert.equal(store.get("usage"),10);
    assert.equal(store.get("currentBatchId"),"old");
    store.setMany({jobs:["new"],usage:20,currentBatchId:"new"});
    assert.equal(store.get("currentBatchId"),"new");
  } finally { store.close(); }
});
