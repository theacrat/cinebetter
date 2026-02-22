import type { ReadonlyDeep } from "type-fest";

import type { CacheAdapter, CachePutOptions } from "@/lib/cache";

const noopCacheAdapter: CacheAdapter = {
	match: async (): Promise<Response | undefined> => {
		await Promise.resolve();
		return undefined;
	},
	put: async (_options: ReadonlyDeep<CachePutOptions>): Promise<void> => {
		await Promise.resolve();
	},
};

export default noopCacheAdapter;
