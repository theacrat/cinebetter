import type { ReqContext } from '../req-context';
import type { UserSettings } from '@/lib/user-settings';
import { env } from '@/env';
import { encodeSettings } from '@/lib/user-settings';
import { getWorkers } from '@/utils/runtime';
import { createBrowserCacheAdapter } from './adapters/browser';
import { noopCacheAdapter } from './adapters/noop';
import { createValkeyCacheAdapter } from './adapters/valkey';

export interface CacheAdapter {
	match: (req: Request) => Promise<Response | undefined>;
	put: (req: Request, res: Response, ttlDays: number) => Promise<void>;
}

export function daysToCacheTime(days: number) {
	return days * 24 * 60 * 60;
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
	fetchFn: () => Promise<{
		response: Response;
		shouldCache: boolean;
		ttlDays: number;
	}>,
) {
	const { response, shouldCache, ttlDays } = await fetchFn();
	const cache = await getCache()();

	const resClone = new Response(response.body, response);
	resClone.headers.set(
		'Cache-Control',
		`public, s-maxage=${daysToCacheTime(ttlDays)}, max-age=${daysToCacheTime(ttlDays)}`,
	);
	resClone.headers.set('Access-Control-Allow-Origin', '*');

	if (shouldCache) {
		await cache.put(req, resClone.clone(), ttlDays);
	}

	return resClone;
}

export async function withCache(
	c: ReqContext,
	settings: UserSettings,
	fetchFn: () => Promise<{
		response: Response;
		shouldCache: boolean;
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
	const cachedResponse = await cache.match(cacheRequest);

	if (cachedResponse) {
		const age = cachedResponse.headers.get('Age');
		const cacheControl = cachedResponse.headers.get('Cache-Control');
		const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1];

		if (Number.parseInt(age ?? '0') > Number.parseInt(maxAge ?? '0')) {
			const refresh = fetchMethod(cacheRequest, fetchFn);

			const workers = await getWorkers();
			workers?.waitUntil(refresh);
		}

		return cachedResponse;
	}

	return fetchMethod(cacheRequest, fetchFn);
}
