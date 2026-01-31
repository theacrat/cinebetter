import type { ReqContext } from '../req-context';
import type { UserSettings } from '@/lib/user-settings';
import { env } from '@/env';
import { encodeSettings } from '@/lib/user-settings';
import { daysToCacheTime, getMaxAge, setHeaders } from '@/utils/cache';
import { getWorkers } from '@/utils/runtime';
import { createBrowserCacheAdapter } from './adapters/browser';
import { noopCacheAdapter } from './adapters/noop';
import { createValkeyCacheAdapter } from './adapters/valkey';

export interface CacheAdapter {
	match: (req: Request, maxCacheDays: number) => Promise<Response | undefined>;
	put: (req: Request, res: Response, ttlDays: number, maxCacheDays: number) => Promise<void>;
}

function getCache() {
	let adapter: CacheAdapter | undefined;

	return async (): Promise<CacheAdapter> => {
		if (!env.USE_CACHE) {
			adapter = noopCacheAdapter;
		}

		if (!adapter) {
			adapter = await createBrowserCacheAdapter('cinebetter')
				?? await createValkeyCacheAdapter()
				?? noopCacheAdapter;
		}

		return adapter;
	};
}

async function fetchMethod(
	req: Request,
	maxCacheDays: number,
	fetchFn: () => Promise<{
		response: Response;
		ttlDays: number;
	}>,
) {
	const { response, ttlDays } = await fetchFn();
	const cache = await getCache()();

	const resClone = new Response(response.body, response);
	setHeaders(resClone.headers, daysToCacheTime(ttlDays));

	if (resClone.ok) {
		const put = cache.put(req, resClone.clone(), ttlDays, maxCacheDays);

		const workers = await getWorkers();
		workers?.waitUntil(put);
	}

	return resClone;
}

export async function withCache(
	c: ReqContext,
	settings: UserSettings,
	maxCacheDays: number,
	fetchFn: () => Promise<{
		response: Response;
		ttlDays: number;
	}>,
): Promise<Response> {
	const normalisedUrl = new URL(c.req.url);

	if (c.settingsParam != null) {
		normalisedUrl.pathname = normalisedUrl.pathname.replace(
			new RegExp(`^/${c.settingsParam}`),
			'',
		);
	}

	const encodedSettings = encodeSettings(settings);
	const settingsPrefix = encodedSettings.size ? `/${encodedSettings.toString()}` : '';
	normalisedUrl.pathname = `${settingsPrefix}${normalisedUrl.pathname}`;

	const cacheRequest = new Request(normalisedUrl, {
		method: c.req.method,
		headers: c.req.headers,
	});

	const cache = await getCache()();
	const cachedResponse = await cache.match(cacheRequest, maxCacheDays);

	if (cachedResponse) {
		const age = cachedResponse.headers.get('Age');
		const maxAge = getMaxAge(cachedResponse.headers);

		if (Number.parseInt(age ?? '0') > maxAge) {
			void fetchMethod(cacheRequest, maxCacheDays, fetchFn);
		}

		return cachedResponse;
	}

	return fetchMethod(cacheRequest, maxCacheDays, fetchFn);
}
