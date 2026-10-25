export function resolveFetch(customFetch?: typeof fetch): typeof fetch {
  if (customFetch) return customFetch;
  if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis);
  }
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    return window.fetch.bind(window);
  }
  throw new Error('No fetch implementation available. Pass options.fetchFn or run in a Node 18+ / browser environment.');
}
