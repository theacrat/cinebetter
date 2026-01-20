import { TitleQuery } from "../../generated/gql/graphql";
import { AppContext } from "../app";
import { createClient, ImdbClient } from "./client";
import { GetMoreEpisodesQuery } from "./graphql/get-more-episodes";
import { TitleFull } from "./graphql/title-full";
import { buildTitle } from "./transformers";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";
import { produce } from "immer";

type EpisodeEdge = NonNullable<
	NonNullable<NonNullable<TitleQuery["title"]>["episodes"]>["episodes"]
>["edges"][number];

type PageInfo = NonNullable<
	NonNullable<NonNullable<TitleQuery["title"]>["episodes"]>["episodes"]
>["pageInfo"];

async function getAllEpisodes(
	initialEpisodes: EpisodeEdge[],
	initialPageInfo: PageInfo,
	titleId: string,
	client: ImdbClient,
): Promise<{ allEpisodes: EpisodeEdge[]; pageInfo: PageInfo }> {
	const allEpisodes = [...initialEpisodes];
	let pageInfo = initialPageInfo;

	while (pageInfo?.hasNextPage && pageInfo.endCursor) {
		const nextPage = await client.query(GetMoreEpisodesQuery, {
			id: titleId,
			after: pageInfo.endCursor,
		});

		const nextEpisodes = nextPage?.title?.episodes?.episodes;
		if (!nextEpisodes) {
			break;
		}

		if (nextEpisodes.edges) {
			allEpisodes.push(...nextEpisodes.edges);
		}
		pageInfo = nextEpisodes.pageInfo;
	}

	return { allEpisodes, pageInfo };
}

function normaliseEpisodes(edges: EpisodeEdge[]): EpisodeEdge[] {
	return edges.reduce<{
		edges: EpisodeEdge[];
		unknownCount: number;
	}>(
		(acc, e) => {
			const episodeData = e?.node?.series?.displayableEpisodeNumber;
			if (!episodeData) {
				return acc;
			}

			const isUnknown =
				e?.node?.series?.displayableEpisodeNumber?.displayableSeason?.text ===
				"unknown";

			if (!isUnknown) {
				acc.edges.push(e);
				return acc;
			}

			const normalizedEdge = produce(e, (draft) => {
				const episodeData = draft.node.series?.displayableEpisodeNumber;
				if (!episodeData) {
					return;
				}

				episodeData.displayableSeason.text = "0";
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
	t: NonNullable<TitleQuery["title"]>,
	client: ImdbClient,
) {
	if (!t.titleType?.canHaveEpisodes) {
		return t;
	}

	const episodes = t?.episodes?.episodes;

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
			pageInfo: pageInfo,
		};
	});
}

export async function getFullTitle(c: AppContext, id: string) {
	const client = createClient(c.var.settings);
	const imdbResults = await client.query(TitleFull, { id });

	const title = imdbResults?.title;

	if (!title) {
		throw new HTTPException(StatusCodes.NOT_FOUND, {
			message: `Couldn't find IMDb ID: ${id}`,
		});
	}

	const processedTitle = await processEpisodes(title, client);

	return buildTitle(c, processedTitle, true, false);
}
