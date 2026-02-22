import type { ReadonlyDeep } from "type-fest";

import type { ImdbClient } from "@/lib/imdb";
import { createClient } from "@/lib/imdb";
import type { ReqContext } from "@/lib/req-context";

import getMoreEpisodesQuery from "./graphql/get-more-episodes";
import titleFull from "./graphql/title-full";
import type { DocumentData } from "./graphql/types";
import { buildTitle } from "./transformers";

const UNKNOWN_SEASON = "unknown";
const UNKNOWN_EPISODE_OFFSET = 1;

type GetMoreEpisodesData = DocumentData<typeof getMoreEpisodesQuery>;
type TitleFullData = DocumentData<typeof titleFull>;

type Title = NonNullable<TitleFullData["title"]>;
type EpisodeEdge = NonNullable<
	NonNullable<NonNullable<Title["episodes"]>["episodes"]>["edges"][number]
>;
type PageInfo = NonNullable<NonNullable<NonNullable<Title["episodes"]>["episodes"]>["pageInfo"]>;
type EpisodesQueryPage = NonNullable<
	NonNullable<NonNullable<GetMoreEpisodesData["title"]>["episodes"]>["episodes"]
>;

interface EpisodesAccumulator {
	readonly allEpisodes: readonly EpisodeEdge[];
	readonly pageInfo: PageInfo;
}

const normaliseEpisode = (edge: EpisodeEdge, unknownEpisodeNumber: string): EpisodeEdge => {
	const sourceEpisodeData = edge.node.series?.displayableEpisodeNumber;
	if (sourceEpisodeData?.displayableSeason.text !== UNKNOWN_SEASON) {
		return edge;
	}

	return {
		...edge,
		node: {
			...edge.node,
			series: {
				...edge.node.series,
				displayableEpisodeNumber: {
					...sourceEpisodeData,
					displayableSeason: { ...sourceEpisodeData.displayableSeason, text: "0" },
					episodeNumber: { ...sourceEpisodeData.episodeNumber, text: unknownEpisodeNumber },
				},
			},
		},
	};
};

const fetchEpisodePages = async (
	accumulator: EpisodesAccumulator,
	titleId: string,
	client: ImdbClient,
): Promise<EpisodesAccumulator> => {
	if (!accumulator.pageInfo.hasNextPage || accumulator.pageInfo.endCursor === null) {
		return accumulator;
	}

	const nextPage = await client.query(getMoreEpisodesQuery, {
		after: accumulator.pageInfo.endCursor,
		id: titleId,
	});

	const nextEpisodes = nextPage?.title?.episodes?.episodes;
	if (nextEpisodes?.edges === undefined) {
		return accumulator;
	}

	const nextEdges = nextEpisodes.edges.filter((edge) => edge !== null);

	return fetchEpisodePages(
		{
			allEpisodes: [...accumulator.allEpisodes, ...nextEdges],
			pageInfo: nextEpisodes.pageInfo,
		},
		titleId,
		client,
	);
};

const normaliseEpisodes = (edges: readonly EpisodeEdge[]): EpisodeEdge[] => {
	const unknownEpisodeNumbers = new Map(
		edges
			.filter(
				(edge) =>
					edge.node.series?.displayableEpisodeNumber?.displayableSeason.text === UNKNOWN_SEASON,
			)
			.map((edge, index) => [edge, (index + UNKNOWN_EPISODE_OFFSET).toString()] as const),
	);

	return edges
		.filter((edge) => edge.node.series?.displayableEpisodeNumber !== undefined)
		.map((edge) => {
			const unknownEpisodeNumber = unknownEpisodeNumbers.get(edge);
			return unknownEpisodeNumber === undefined
				? edge
				: normaliseEpisode(edge, unknownEpisodeNumber);
		});
};

const processEpisodes = async (title: Title, client: ImdbClient): Promise<Title> => {
	if (title.titleType?.canHaveEpisodes !== true) {
		return title;
	}

	const episodes = title.episodes?.episodes;
	if (episodes?.edges === undefined) {
		return title;
	}

	const initialEpisodes = episodes.edges.filter((edge) => edge !== null);

	const { allEpisodes, pageInfo } = await fetchEpisodePages(
		{
			allEpisodes: initialEpisodes,
			pageInfo: episodes.pageInfo,
		},
		title.id,
		client,
	);

	return {
		...title,
		episodes: {
			...title.episodes,
			episodes: {
				edges: normaliseEpisodes(allEpisodes),
				pageInfo,
			},
		},
	};
};

const getFullTitle = async (
	context: ReadonlyDeep<ReqContext>,
	id: string,
): Promise<Awaited<ReturnType<typeof buildTitle>>> => {
	const client = createClient(context.settings);
	const imdbResults = await client.query(titleFull, { id });
	const title = imdbResults?.title;

	if (title?.id === undefined) {
		throw new Error(`Couldn't find IMDb ID: ${id}`);
	}

	const processedTitle = await processEpisodes(title, client);
	return buildTitle({
		context,
		filterNoMatch: false,
		matchTmdb: true,
		title: processedTitle,
	});
};

export default getFullTitle;
export type { EpisodesQueryPage, PageInfo, Title };
