import type { TitleQuery } from '@/generated/gql/graphql';
import type { ImdbClient } from '@/lib/imdb';
import type { ReqContext } from '@/lib/req-context';
import { produce } from 'immer';
import { createClient } from '@/lib/imdb';
import { GetMoreEpisodesQuery } from './graphql/get-more-episodes';
import { TitleFull } from './graphql/title-full';
import { buildTitle } from './transformers';

type EpisodeEdge = NonNullable<
	NonNullable<NonNullable<TitleQuery['title']>['episodes']>['episodes']
>['edges'][number];

type PageInfo = NonNullable<
	NonNullable<NonNullable<TitleQuery['title']>['episodes']>['episodes']
>['pageInfo'];

async function getAllEpisodes(
	initialEpisodes: Array<EpisodeEdge>,
	initialPageInfo: PageInfo,
	titleId: string,
	client: ImdbClient,
): Promise<{ allEpisodes: Array<EpisodeEdge>; pageInfo: PageInfo }> {
	const allEpisodes = [...initialEpisodes];
	let pageInfo = initialPageInfo;

	while (pageInfo.hasNextPage && pageInfo.endCursor != null) {
		const nextPage = await client.query(GetMoreEpisodesQuery, {
			id: titleId,
			after: pageInfo.endCursor,
		});

		const nextEpisodes = nextPage?.title?.episodes?.episodes;
		if (!nextEpisodes) {
			break;
		}

		allEpisodes.push(...nextEpisodes.edges);

		pageInfo = nextEpisodes.pageInfo;
	}

	return { allEpisodes, pageInfo };
}

function normaliseEpisodes(edges: Array<EpisodeEdge>): Array<EpisodeEdge> {
	return edges.reduce<{
		edges: Array<EpisodeEdge>;
		unknownCount: number;
	}>(
		(acc, e) => {
			const episodeData = e?.node.series?.displayableEpisodeNumber;
			if (!episodeData) {
				return acc;
			}

			const isUnknown
				= e.node.series?.displayableEpisodeNumber.displayableSeason.text
					=== 'unknown';

			if (!isUnknown) {
				acc.edges.push(e);
				return acc;
			}

			const normalizedEdge = produce(e, (draft) => {
				const episodeData = draft.node.series?.displayableEpisodeNumber;
				if (!episodeData) {
					return;
				}

				episodeData.displayableSeason.text = '0';
				episodeData.episodeNumber.text = (acc.unknownCount + 1).toString();
			});

			acc.edges.push(normalizedEdge);
			acc.unknownCount++;
			return acc;
		},
		{ edges: [], unknownCount: 0 },
	).edges;
}

async function processEpisodes(
	t: NonNullable<TitleQuery['title']>,
	client: ImdbClient,
) {
	if (!t.titleType?.canHaveEpisodes) {
		return t;
	}

	const episodes = t.episodes?.episodes;

	if (!episodes) {
		return t;
	}

	const { allEpisodes, pageInfo } = await getAllEpisodes(
		episodes.edges,
		episodes.pageInfo,
		t.id,
		client,
	);

	const normalisedEpisodes = normaliseEpisodes(allEpisodes);

	return produce(t, (draft) => {
		if (!draft.episodes?.episodes) {
			return;
		}

		draft.episodes.episodes = {
			edges: normalisedEpisodes,
			pageInfo,
		};
	});
}

export async function getFullTitle(c: ReqContext, id: string) {
	const client = createClient(c.settings);
	const imdbResults = await client.query(TitleFull, { id });

	const title = imdbResults?.title;

	if (!title) {
		throw new Error(`Couldn't find IMDb ID: ${id}`);
	}

	const processedTitle = await processEpisodes(title, client);

	return buildTitle(c, processedTitle, true, false);
}
