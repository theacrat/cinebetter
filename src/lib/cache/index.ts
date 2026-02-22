import type { ReadonlyDeep } from "type-fest";

import env from "@/env";
import type { ReqContext } from "@/lib/req-context";
import type { UserSettings } from "@/lib/user-settings";
import { encodeSettings } from "@/lib/user-settings";
import { daysToCacheTime, getMaxAge, setHeaders } from "@/utils/cache";
import getWorkers from "@/utils/runtime";

import createBrowserCacheAdapter from "./adapters/browser";
import noopCacheAdapter from "./adapters/noop";
import { createValkeyCacheAdapter } from "./adapters/valkey";

const MIN_NON_EMPTY_PARAM_SIZE = 1;
const ZERO_AGE_FALLBACK = "0";

interface CachePutOptions {
	readonly maxCacheDays: number;
	readonly req: Request;
	readonly res: Response;
	readonly ttlDays: number;
}

interface CacheAdapter {
	match: (req: ReadonlyDeep<Request>, maxCacheDays: number) => Promise<Response | undefined>;
	put: (options: ReadonlyDeep<CachePutOptions>) => Promise<void>;
}

interface CacheFetchResult {
	readonly response: Response;
	readonly ttlDays: number;
}

interface WithCacheOptions {
	readonly context: ReqContext;
	readonly fetchFn: () => Promise<CacheFetchResult>;
	readonly maxCacheDays: number;
	readonly settings: UserSettings;
}

declare global {
	var __cinebetterCacheAdapter: CacheAdapter | undefined;
}

const getCache = async (): Promise<CacheAdapter> => {
	if (!env.USE_CACHE) {
		return noopCacheAdapter;
	}

	globalThis.__cinebetterCacheAdapter ??=
		(await createBrowserCacheAdapter("cinebetter")) ??
		(await createValkeyCacheAdapter()) ??
		noopCacheAdapter;

	return globalThis.__cinebetterCacheAdapter;
};

const fetchMethod = async (
	req: ReadonlyDeep<Request>,
	maxCacheDays: number,
	fetchFn: () => Promise<CacheFetchResult>,
): Promise<Response> => {
	const { response, ttlDays } = await fetchFn();
	const cache = await getCache();

	const responseHeaders = setHeaders(response.headers, daysToCacheTime(ttlDays));
	const responseClone = new Response(response.body, {
		headers: responseHeaders,
		status: response.status,
		statusText: response.statusText,
	});

	if (responseClone.ok) {
		const put = cache.put({
			maxCacheDays,
			req,
			res: responseClone.clone(),
			ttlDays,
		});
		const workers = await getWorkers();
		workers?.waitUntil(put);
	}

	return responseClone;
};

const refreshStaleCache = async (
	cacheRequest: ReadonlyDeep<Request>,
	fetchFn: () => Promise<CacheFetchResult>,
	maxCacheDays: number,
): Promise<void> => {
	try {
		await fetchMethod(cacheRequest, maxCacheDays, fetchFn);
	} catch {}
};

const withCache = async ({
	context,
	fetchFn,
	maxCacheDays,
	settings,
}: ReadonlyDeep<WithCacheOptions>): Promise<Response> => {
	const requestUrl = new URL(context.req.url);
	const normalisedPathname =
		context.settingsParam === undefined
			? requestUrl.pathname
			: requestUrl.pathname.replace(new RegExp(`^/${context.settingsParam}`), "");

	const encodedSettings = encodeSettings(settings);
	const settingsPrefix =
		encodedSettings.size >= MIN_NON_EMPTY_PARAM_SIZE ? `/${encodedSettings.toString()}` : "";
	const updatedPathname = `${settingsPrefix}${normalisedPathname}`;
	const normalisedUrl = new URL(
		`${updatedPathname}${requestUrl.search}${requestUrl.hash}`,
		requestUrl.origin,
	);

	const cacheRequest = new Request(normalisedUrl, {
		headers: context.req.headers,
		method: context.req.method,
	});

	const cache = await getCache();
	const cachedResponse = await cache.match(cacheRequest, maxCacheDays);

	if (cachedResponse) {
		const age = cachedResponse.headers.get("Age");
		const maxAge = getMaxAge(cachedResponse.headers);

		if (Number.parseInt(age ?? ZERO_AGE_FALLBACK, 10) > maxAge) {
			const refreshPromise = refreshStaleCache(cacheRequest, fetchFn, maxCacheDays);
			const workers = await getWorkers();
			workers?.waitUntil(refreshPromise);
		}

		return cachedResponse;
	}

	return fetchMethod(cacheRequest, maxCacheDays, fetchFn);
};

export { withCache, type CacheAdapter, type CachePutOptions };
