import { UserSettings, encodeSettings } from "../../shared/user-settings";
import type { Context } from "hono";
import { env } from "hono/adapter";

const cache = (() => {
	if (typeof caches !== "undefined" && caches.default) {
		return caches.default;
	}
	return {
		match: async () => null,
		put: async () => {},
	};
})();

function daysToCacheTime(days: number) {
	return days * 24 * 60 * 60;
}

async function refreshCache(
	cacheRequest: Request,
	fetchFn: () => Promise<{
		response: Response;
		shouldCache: boolean;
		ttlDays: number;
	}>,
) {
	try {
		const { response, shouldCache, ttlDays } = await fetchFn();
		if (shouldCache) {
			response.headers.append(
				"Cache-Control",
				`public, max-age=${daysToCacheTime(ttlDays)}, stale-while-revalidate=${daysToCacheTime(ttlDays)}`,
			);
			await cache.put(cacheRequest, response.clone());
		}
	} catch (error) {
		console.error("Background cache refresh failed:", error);
	}
}

export async function withCache(
	c: Context,
	settings: UserSettings,
	fetchFn: () => Promise<{
		response: Response;
		shouldCache: boolean;
		ttlDays: number;
	}>,
): Promise<Response> {
	const settingsParam = c.req.param("settings");

	const normalisedUrl = new URL(c.req.url);
	if (settingsParam) {
		normalisedUrl.pathname = normalisedUrl.pathname.replace(
			`/${settingsParam}`,
			"",
		);
	}
	normalisedUrl.pathname = `/${encodeSettings(settings)}${normalisedUrl.pathname}`;

	const cacheRequest = new Request(normalisedUrl, c.req.raw);

	const cachedResponse = await cache.match(cacheRequest);
	if (cachedResponse && env(c).NODE_ENV === "production") {
		const age = cachedResponse.headers.get("Age");
		const cacheControl = cachedResponse.headers.get("Cache-Control");
		const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1];

		if (age && maxAge && parseInt(age) > parseInt(maxAge)) {
			c.executionCtx.waitUntil(refreshCache(cacheRequest, fetchFn));
		}

		return cachedResponse;
	}

	const { response, shouldCache, ttlDays } = await fetchFn();

	if (shouldCache) {
		response.headers.append(
			"Cache-Control",
			`public, max-age=${daysToCacheTime(ttlDays)}, stale-while-revalidate=${daysToCacheTime(ttlDays)}`,
		);
		cache.put(cacheRequest, response.clone());
	}

	return response;
}
