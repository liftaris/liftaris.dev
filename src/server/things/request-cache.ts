import { AsyncLocalStorage } from 'node:async_hooks';
import { getRequestContext } from 'emdash/request-context';

const reads = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

export function withThingReads<T>(render: () => T): T {
  return reads.run(new Map(), render);
}

export function readOnce<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cache = reads.getStore();
  if (!cache) return load();
  const context = getRequestContext();
  const scopedKey = JSON.stringify([key, context?.locale, context?.editMode, context?.preview]);
  // The key belongs to this typed loader and the map lives for one request only.
  if (cache.has(scopedKey)) return cache.get(scopedKey) as Promise<T>;
  const pending = load();
  cache.set(scopedKey, pending);
  return pending;
}
