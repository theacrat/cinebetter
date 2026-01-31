import type { CacheAdapter } from '..';

export const noopCacheAdapter: CacheAdapter = {
	match: async () => undefined,
	put: async () => {},
};
