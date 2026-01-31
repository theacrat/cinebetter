import type { ReqContext } from '@/lib/req-context';
import type { UserSettings } from '@/lib/user-settings';
import { createFileRoute } from '@tanstack/react-router';
import { env } from '@/env';
import { withCache } from '@/lib/cache';
import { buildReqContext } from '@/lib/req-context';
import { DEFAULT_SETTINGS } from '@/lib/user-settings';
import { getFullTitle } from '@/services/imdb';

export const Route = createFileRoute('/{-$settings}/meta/$type/{$id}.json')({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const { id } = params;
				const c = buildReqContext(request, params.settings);

				return metaGet(c, id);
			},
		},
	},
});

async function metaGet(c: ReqContext, id: string) {
	const cacheSettings: UserSettings = {
		...DEFAULT_SETTINGS,
		languageCode: c.settings.languageCode,
	};

	return withCache(c,	cacheSettings, env.CACHE_DAYS_META, async () => {
		const result = await getFullTitle(c, (id ?? ''));
		const isOngoing = result?.releaseInfo?.match(/^\d*-$/);

		return {
			response: result
				? Response.json({ meta: result })
				: new Response('Not found', { status: 404 }),
			ttlDays: isOngoing ? 1 : 14,
		};
	});
};
