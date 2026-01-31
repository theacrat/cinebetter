import type { ReqContext } from '@/lib/req-context';
import type { UserSettings } from '@/lib/user-settings';
import { createFileRoute } from '@tanstack/react-router';
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

	return withCache(c,	cacheSettings, async () => {
		const result = await getFullTitle(c, (id ?? ''));

		return {
			response: result
				? Response.json({ meta: result })
				: new Response('Not found', { status: 404 }),
			shouldCache: !!result,
			ttlDays: 3,
		};
	});
};
