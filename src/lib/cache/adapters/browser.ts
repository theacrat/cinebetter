import type { CacheAdapter } from '..';

async function getCache(key: string) {
	try {
		return await caches.open(key);
	}
	catch {
		return undefined;
	}
}

export async function createBrowserCacheAdapter(key: string): Promise<CacheAdapter | undefined> {
	const cache = await getCache(key);
	if (!cache) {
		return;
	}

	return {
		match: async req => cache.match(req),
		put: async (req, res) => { await cache.put(req, res); },
	};
}
