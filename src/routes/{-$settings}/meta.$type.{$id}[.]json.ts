/* eslint-disable require-await */
import { createFileRoute } from "@tanstack/react-router";
import type { ReadonlyDeep } from "type-fest";

import env from "@/env";
import { withCache } from "@/lib/cache";
import { buildReqContext } from "@/lib/req-context";
import type { UserSettings } from "@/lib/user-settings";
import { DEFAULT_SETTINGS } from "@/lib/user-settings";
import { getFullTitle } from "@/services/imdb";

const LONG_CACHE_DAYS = 14;
const NOT_FOUND_STATUS = 404;
const SHORT_CACHE_DAYS = 1;

interface MetaGetProps {
	readonly params: {
		readonly id: string;
		readonly settings: string;
	};
	readonly request: ReadonlyDeep<Request>;
}

const metaGet = async ({ params, request }: MetaGetProps): Promise<Response> => {
	const { id } = params;
	const context = buildReqContext(request, params.settings);

	const cacheSettings: UserSettings = {
		...DEFAULT_SETTINGS,
		languageCode: context.settings.languageCode,
	};

	const response = withCache({
		context,
		fetchFn: async () => {
			const data = await getFullTitle(context, id);
			const isOngoing = data?.releaseInfo?.match(/^\d*-$/);

			return {
				response: data
					? Response.json({ meta: data })
					: new Response("Not found", { status: NOT_FOUND_STATUS }),
				ttlDays: isOngoing ? SHORT_CACHE_DAYS : LONG_CACHE_DAYS,
			};
		},
		maxCacheDays: env.CACHE_DAYS_META,
		settings: cacheSettings,
	});

	return response;
};

export const Route = createFileRoute("/{-$settings}/meta/$type/{$id}.json")({
	server: {
		handlers: {
			GET: metaGet,
		},
	},
});
