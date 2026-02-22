import type { ReadonlyDeep } from "type-fest";

import type { CacheAdapter } from "@/lib/cache";

const getCache = async (key: string): Promise<Cache | undefined> => {
	try {
		return await caches.open(key);
	} catch {
		return undefined;
	}
};

const createBrowserCacheAdapter = async (key: string): Promise<CacheAdapter | undefined> => {
	const cache = await getCache(key);
	if (!cache) {
		return undefined;
	}

	return {
		match: async (req: ReadonlyDeep<Request>): Promise<Response | undefined> => {
			const cacheRequest = new Request(req.url, {
				headers: req.headers,
				method: req.method,
			});
			return (await cache.match(cacheRequest)) ?? undefined;
		},
		put: async ({ req, res }): Promise<void> => {
			const cacheRequest = new Request(req.url, {
				headers: req.headers,
				method: req.method,
			});
			const cacheResponse = new Response(res.body, res);
			await cache.put(cacheRequest, cacheResponse);
		},
	};
};

export default createBrowserCacheAdapter;
