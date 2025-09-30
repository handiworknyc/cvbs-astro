// src/lib/cache.ts
type Entry<T> = { v: T; exp: number };
export function createCache<T>(ttlMs = 60_000) {
  const store = new Map<string, Entry<T>>();
  function get(key: string): T | undefined {
    const e = store.get(key);
    if (!e) return;
    if (Date.now() > e.exp) { store.delete(key); return; }
    return e.v;
  }
  function set(key: string, v: T) {
    store.set(key, { v, exp: Date.now() + ttlMs });
  }
  function memo(fn: (...a: any[]) => Promise<T>, keyer: (...a:any[]) => string) {
    return async (...a: any[]) => {
      const key = keyer(...a);
      const hit = get(key);
      if (hit !== undefined) return hit;
      const v = await fn(...a);
      set(key, v);
      return v;
    };
  }
  return { get, set, memo };
}
