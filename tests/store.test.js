import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEY } from "../js/constants.js";
import {
  Store,
  decrementUse,
  incrementUse,
  normalizeItem,
  resetWash,
} from "../js/store.js";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe("wear counts", () => {
  it("increments since-wash and lifetime together", () => {
    const next = incrementUse(
      normalizeItem({ name: "Jeans", type: "pants", usesSinceWash: 1, totalUses: 10 }),
    );
    assert.equal(next.usesSinceWash, 2);
    assert.equal(next.totalUses, 11);
  });

  it("decrements both and will not go below zero", () => {
    const item = normalizeItem({
      name: "Jeans",
      type: "pants",
      usesSinceWash: 1,
      totalUses: 10,
    });
    const once = decrementUse(item);
    assert.equal(once.usesSinceWash, 0);
    assert.equal(once.totalUses, 9);
    const twice = decrementUse(once);
    assert.equal(twice.usesSinceWash, 0);
    assert.equal(twice.totalUses, 9);
  });

  it("resetting a wash leaves lifetime uses alone", () => {
    const item = normalizeItem({
      name: "Hoodie",
      type: "sweaters",
      usesSinceWash: 4,
      totalUses: 20,
    });
    const washed = resetWash(item);
    assert.equal(washed.usesSinceWash, 0);
    assert.equal(washed.totalUses, 20);
  });
});

describe("Store", () => {
  it("persists add / increment / wash / merge", () => {
    const storage = memoryStorage();
    const store = new Store(storage);
    const added = store.add({ name: "Chinos", type: "pants" });
    store.increment(added.id);
    store.increment(added.id);
    store.resetWash(added.id);
    const stored = JSON.parse(storage.getItem(STORAGE_KEY));
    assert.equal(stored[0].usesSinceWash, 0);
    assert.equal(stored[0].totalUses, 2);

    store.merge([
      { id: added.id, name: "Navy chinos", type: "pants", usesSinceWash: 1, totalUses: 5 },
      { name: "Gym shorts", type: "shorts", usesSinceWash: 0, totalUses: 0 },
    ]);
    assert.equal(store.list().length, 2);
    assert.equal(store.get(added.id).name, "Navy chinos");
    assert.equal(store.get(added.id).totalUses, 5);
  });

  it("replaceAll overwrites the closet", () => {
    const store = new Store(memoryStorage());
    store.add({ name: "Old", type: "pants" });
    store.replaceAll([{ name: "New shorts", type: "shorts" }]);
    assert.equal(store.list().length, 1);
    assert.equal(store.list()[0].name, "New shorts");
  });
});
