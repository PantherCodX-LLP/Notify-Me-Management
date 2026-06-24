/**
 * Tiny in-memory TTL cache so heavy analytics queries (e.g. GROUP BY over the
 * 1.1M-row variant_stock_notifications table) are not recomputed on every page
 * load. Keeps the dashboard responsive and bounds DB load for 24x7 operation.
 *
 * Errors are never cached. Cache is per-process (fine for a single Node server).
 */
interface Entry {
  at: number;
  val: any;
}
const store = new Map<string, Entry>();
const MAX = 300;

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.val as T;
  const val = await fn();
  store.set(key, { at: Date.now(), val });
  if (store.size > MAX) {
    // evict oldest
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, v] of store) if (v.at < oldestAt) { oldestAt = v.at; oldestKey = k; }
    if (oldestKey) store.delete(oldestKey);
  }
  return val;
}
