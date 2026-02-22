import { createFileRoute } from "@tanstack/react-router";
import stripUndefined from "strip-undefined";
import type { ReadonlyDeep } from "type-fest";

import env from "@/env";
import { withCache } from "@/lib/cache";
import { buildReqContext } from "@/lib/req-context";
import type { UserSettings } from "@/lib/user-settings";
import { DEFAULT_SETTINGS } from "@/lib/user-settings";
import { getCatalog } from "@/services/imdb";
import {
	CinebetterCatalogs,
	isCatalog,
	isDetailedCatalog,
	isSupportedType,
} from "@/services/manifest";

const NO_CACHE_TTL_DAYS = 0;
const NOT_FOUND_STATUS = 404;
const SEARCH_TTL_DAYS = 1;
const STANDARD_TTL_DAYS = 7;

interface CatalogGetProps {
	readonly params: {
		readonly type: string;
		readonly catalog: string;
		readonly settings: string;
		readonly query: string | undefined;
	};
	readonly request: ReadonlyDeep<Request>;
}

const catalogGet = async ({ params, request }: CatalogGetProps): Promise<Response> => {
	const { type, catalog, query, settings } = params;

	const context = buildReqContext(request, settings);
	const queryParams = new URLSearchParams(query ?? "");

	const cacheSettings = stripUndefined<UserSettings>({
		...DEFAULT_SETTINGS,
		hideLowQuality: queryParams === null ? undefined : context.settings.hideLowQuality,
		languageCode: context.settings.languageCode,
	});

	const response = await withCache({
		context,
		fetchFn: async () => {
			if (!isCatalog(catalog) || !isSupportedType(type)) {
				return {
					response: new Response("Not found", { status: NOT_FOUND_STATUS }),
					shouldCache: false,
					ttlDays: NO_CACHE_TTL_DAYS,
				};
			}

			const data = await getCatalog({
				catalogId: catalog,
				context,
				queryParams,
				type,
			});

			return {
				response: Response.json(
					isDetailedCatalog(catalog) ? { metasDetailed: data } : { metas: data },
				),
				ttlDays: catalog === CinebetterCatalogs.SEARCH ? SEARCH_TTL_DAYS : STANDARD_TTL_DAYS,
			};
		},
		maxCacheDays: env.CACHE_DAYS_CATALOG,
		settings: cacheSettings,
	});

	return response;
};

export const Route = createFileRoute("/{-$settings}/catalog/$type/$catalog/{-$query}.json")({
	server: {
		handlers: {
			GET: catalogGet,
		},
	},
});
