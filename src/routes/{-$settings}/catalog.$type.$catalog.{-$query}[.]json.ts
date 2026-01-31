import type { ReqContext } from '@/lib/req-context';
import type { UserSettings } from '@/lib/user-settings';
import { createFileRoute } from '@tanstack/react-router';
import { ExtraTypes } from 'stremio-types';
import { env } from '@/env';
import { withCache } from '@/lib/cache';
import { buildReqContext } from '@/lib/req-context';
import { DEFAULT_SETTINGS } from '@/lib/user-settings';
import { getCatalog } from '@/services/imdb';
import { CinebetterCatalogs, isCatalog, isDetailedCatalog, isSupportedType } from '@/services/manifest';

export const Route = createFileRoute('/{-$settings}/catalog/$type/$catalog/{-$query}.json')({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const { type, catalog, query } = params;
				const c = buildReqContext(request, params.settings);

				return catalogGet(c, type, catalog, query);
			},
		},
	},
});

async function catalogGet(c: ReqContext, type: string, catalog: string, query?: string) {
	const queryParam = new URLSearchParams(query ?? '');

	const cacheSettings: UserSettings = {
		...DEFAULT_SETTINGS,
		languageCode: c.settings.languageCode,
		...(queryParam.get(ExtraTypes.SEARCH) != null && { hideLowQuality: c.settings.hideLowQuality }),
	};

	return withCache(c, cacheSettings, env.CACHE_DAYS_CATALOG, async () => {
		if (!isCatalog(catalog) || !isSupportedType(type)) {
			return {
				response: new Response('Not found', { status: 404 }),
				shouldCache: false,
				ttlDays: 0,
			};
		}

		const result = await getCatalog(c, catalog, queryParam, type);

		return {
			response: Response.json(
				isDetailedCatalog(catalog)
					? { metasDetailed: result }
					: { metas: result },
			),
			ttlDays: catalog === CinebetterCatalogs.SEARCH ? 1 : 7,
		};
	});
};
