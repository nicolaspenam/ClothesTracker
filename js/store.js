import { STORAGE_KEY, TYPE_IDS } from "./constants.js";

export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function normalizeItem(raw, fallbackNow = new Date().toISOString()) {
  const usesSinceWash = clampCount(raw?.usesSinceWash);
  const totalUses = Math.max(clampCount(raw?.totalUses), usesSinceWash);
  const type = TYPE_IDS.includes(raw?.type) ? raw.type : "pants";
  return {
    id: String(raw?.id || createId()),
    name: String(raw?.name || "").trim() || "Untitled",
    type,
    firstUsed: raw?.firstUsed || null,
    usesSinceWash,
    totalUses,
    createdAt: raw?.createdAt || fallbackNow,
    updatedAt: raw?.updatedAt || fallbackNow,
  };
}

export function incrementUse(item) {
  return {
    ...item,
    usesSinceWash: item.usesSinceWash + 1,
    totalUses: item.totalUses + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function decrementUse(item) {
  if (item.usesSinceWash <= 0) return item;
  return {
    ...item,
    usesSinceWash: item.usesSinceWash - 1,
    totalUses: Math.max(0, item.totalUses - 1),
    updatedAt: new Date().toISOString(),
  };
}

export function resetWash(item) {
  if (item.usesSinceWash === 0) return item;
  return {
    ...item,
    usesSinceWash: 0,
    updatedAt: new Date().toISOString(),
  };
}

export class Store {
  constructor(storage) {
    this.storage = storage ?? globalThis.localStorage;
    this.listeners = new Set();
    this.items = this.#load();
  }

  #load() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => normalizeItem(item));
    } catch {
      return [];
    }
  }

  #save() {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.items));
    for (const listener of this.listeners) listener(this.items);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list() {
    return this.items.map((item) => ({ ...item }));
  }

  get(id) {
    const item = this.items.find((entry) => entry.id === id);
    return item ? { ...item } : null;
  }

  add(data) {
    const item = normalizeItem({
      ...data,
      id: data.id || createId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this.items = [item, ...this.items];
    this.#save();
    return { ...item };
  }

  update(id, patch) {
    let updated = null;
    this.items = this.items.map((item) => {
      if (item.id !== id) return item;
      updated = normalizeItem({
        ...item,
        ...patch,
        id,
        createdAt: item.createdAt,
        updatedAt: new Date().toISOString(),
      });
      return updated;
    });
    if (updated) this.#save();
    return updated ? { ...updated } : null;
  }

  remove(id) {
    const next = this.items.filter((item) => item.id !== id);
    if (next.length === this.items.length) return false;
    this.items = next;
    this.#save();
    return true;
  }

  increment(id) {
    return this.#mutate(id, incrementUse);
  }

  decrement(id) {
    return this.#mutate(id, decrementUse);
  }

  resetWash(id) {
    return this.#mutate(id, resetWash);
  }

  replaceAll(items) {
    const now = new Date().toISOString();
    this.items = items.map((item) =>
      normalizeItem(
        {
          ...item,
          createdAt: item.createdAt || now,
          updatedAt: now,
        },
        now,
      ),
    );
    this.#save();
    return this.list();
  }

  merge(items) {
    const now = new Date().toISOString();
    const byId = new Map(this.items.map((item) => [item.id, item]));
    for (const incoming of items) {
      const normalized = normalizeItem(
        {
          ...incoming,
          createdAt: incoming.createdAt || now,
          updatedAt: now,
        },
        now,
      );
      if (incoming.id && byId.has(incoming.id)) {
        const existing = byId.get(incoming.id);
        byId.set(incoming.id, {
          ...normalized,
          id: existing.id,
          createdAt: existing.createdAt,
        });
      } else {
        byId.set(normalized.id, normalized);
      }
    }
    this.items = [...byId.values()];
    this.#save();
    return this.list();
  }

  #mutate(id, fn) {
    let updated = null;
    this.items = this.items.map((item) => {
      if (item.id !== id) return item;
      updated = fn(item);
      return updated;
    });
    if (updated) this.#save();
    return updated ? { ...updated } : null;
  }
}

function clampCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}
