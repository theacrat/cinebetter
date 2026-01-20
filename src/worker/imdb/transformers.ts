import type {
	AdvancedTitleSearchQuery,
	TitleQuery,
	TitlesQuery,
} from "../../generated/gql/graphql";
import { AppContext } from "../app";
import { CinebetterCatalogs } from "../manifest";
import { matchId } from "../tmdb";
import { getTransportUrl } from "../utils/transport-url";
import {
	Link,
	MetaItem,
	ContentType,
	Video,
	ContentTypes,
} from "stremio-types";

export type TitleIntersection = TitleQuery["title"] &
	TitlesQuery["titles"][number] &
	NonNullable<
		NonNullable<
			AdvancedTitleSearchQuery["advancedTitleSearch"]
		>["edges"][number]
	>["node"]["title"];

type EpisodeEdge = NonNullable<
	NonNullable<TitleIntersection["episodes"]>["episodes"]
>["edges"][number];

async function getTmdbMatch(
	c: AppContext,
	titleId: string,
	connection: string | undefined,
): Promise<[Awaited<ReturnType<typeof matchId>>, boolean]> {
	let tmdbMatch = await matchId(c, titleId, !connection);
	let usedConnection = false;
	if (tmdbMatch.every((m) => !m) && connection) {
		tmdbMatch = await matchId(c, connection, true);
		usedConnection = true;
	}
	return [tmdbMatch, usedConnection];
}

function getConnectionId(
	title: Partial<TitleIntersection>,
): string | undefined {
	const firstLevelConnection = title.connections?.edges.find((c) => c);
	if (!firstLevelConnection) {
		return undefined;
	}

	const secondLevelConnection =
		firstLevelConnection.node.associatedTitle.connections?.edges.find((c) => c);
	if (secondLevelConnection) {
		return secondLevelConnection.node.associatedTitle.id;
	}

	return firstLevelConnection.node.associatedTitle.id;
}

function buildEpisodeVideo(
	titleId: string,
	episode: EpisodeEdge,
): Video | undefined {
	if (!episode?.node.titleText) {
		return;
	}

	const season = parseInt(
		episode.node.series?.displayableEpisodeNumber?.displayableSeason?.text ||
			"",
	);
	const episodeNumber = parseInt(
		episode.node.series?.displayableEpisodeNumber?.episodeNumber?.text || "",
	);

	return {
		id: [titleId, season, episodeNumber].join(":"),
		title: episode.node.titleText.text,
		released: episode?.node?.releaseDate?.year
			? new Date(
					Date.UTC(
						episode.node.releaseDate.year,
						(episode.node.releaseDate.month || 12) - 1,
						episode.node.releaseDate.day || 31,
					),
				).toISOString()
			: undefined,
		thumbnail: episode.node.primaryImage?.url || undefined,
		episode: episodeNumber,
		season: season,
		overview: episode.node.plot?.plotText?.plainText || undefined,
	};
}

function buildVideos(title: Partial<TitleIntersection>): Video[] | undefined {
	if (!title.titleType?.canHaveEpisodes || !title.id) {
		return;
	}

	const episodes = title.episodes?.episodes?.edges;
	if (!episodes) {
		return;
	}

	return episodes
		.map((e) => buildEpisodeVideo(title.id!, e))
		.filter((v) => !!v);
}

function formatReleaseInfo(
	type: ContentType,
	releaseYear: TitleIntersection["releaseYear"],
): string | undefined {
	if (!releaseYear?.year) {
		return;
	}

	if (releaseYear.year === releaseYear.endYear || type === ContentTypes.MOVIE) {
		return releaseYear.year.toString();
	}

	return `${releaseYear.year}-${releaseYear.endYear || ""}`;
}

function buildCreditLinks(
	principalCredits: TitleIntersection["principalCredits"],
): Link[] {
	const categoryMap: Record<string, string> = {
		cast: "Cast",
		director: "Directors",
		writer: "Writers",
	};

	return (
		principalCredits?.flatMap((p) => {
			const categoryId = p?.category?.id;
			if (!categoryId || !categoryMap[categoryId]) {
				return [];
			}

			return (
				p.credits.flatMap((c) => {
					const name = c?.name.nameText?.text;
					if (!name) {
						return [];
					}

					return {
						name,
						category: categoryMap[categoryId],
						url: `stremio:///search?search=${encodeURIComponent(name)}`,
					};
				}) || []
			);
		}) || []
	);
}

function buildGenreLinks(
	genres: TitleIntersection["titleGenres"],
	type: ContentType,
	transportUrl: string,
): Link[] {
	return (
		genres?.genres?.flatMap((g) => {
			if (!g) {
				return [];
			}

			return {
				name: g.genre.text,
				category: "Genres",
				url: `stremio:///discover/${encodeURIComponent(transportUrl)}/${type}/${CinebetterCatalogs.POPULAR}?genre=${g.genre.text}`,
			};
		}) || []
	);
}

function buildLinks(
	title: Partial<TitleIntersection>,
	type: ContentType,
	transportUrl: string,
) {
	const stremioLinks: Link[] = [
		title?.ratingsSummary?.aggregateRating
			? {
					name: title?.ratingsSummary?.aggregateRating?.toString(),
					category: "imdb",
					url: `https://imdb.com/title/${title.id}`,
				}
			: [],
		title.id && title?.titleText?.text
			? {
					name: title?.titleText?.text,
					category: "share",
					url: `https://www.strem.io/s/${type}/${title.id.split("tt")[1]}`,
				}
			: [],
	].flat();

	return [
		stremioLinks,
		buildGenreLinks(title.titleGenres, type, transportUrl),
		buildCreditLinks(title.principalCredits),
	].flat();
}

export async function buildTitle(
	c: AppContext,
	title: Partial<TitleIntersection>,
	matchTmdb: boolean,
	filterNoMatch: boolean,
) {
	if (!title.id || !title.titleText?.text) {
		return;
	}

	const type: ContentType = title.titleType?.canHaveEpisodes
		? ContentTypes.SERIES
		: ContentTypes.MOVIE;

	const connection = getConnectionId(title);

	let tmdbMatch;
	let matchedConnection = false;
	if (matchTmdb) {
		[tmdbMatch, matchedConnection] = await getTmdbMatch(
			c,
			title.id,
			connection,
		);

		if (
			c.var.settings.hideLowQuality &&
			filterNoMatch &&
			tmdbMatch.every((m) => !m)
		) {
			return;
		}
	}

	const videos = buildVideos(title);

	const hasScheduledVideos = !!(videos || []).find((v) =>
		v.released ? new Date(v.released) > new Date() : false,
	);

	const meta: MetaItem = {
		id: title.id,
		type: type,
		name: title.titleText.text,
		posterShape: "poster",
		background: `https://images.metahub.space/background/large/${matchedConnection ? connection : title.id}/img`,
		logo: `https://images.metahub.space/logo/large/${matchedConnection ? connection : title.id}/img`,
		genres: title.titleGenres?.genres.flatMap((g) => g?.genre.text || []),
		poster: title.primaryImage?.url || undefined,
		description: title.plot?.plotText?.plainText || undefined,
		releaseInfo: formatReleaseInfo(type, title.releaseYear),
		links: buildLinks(title, type, getTransportUrl(c)),
		imdbRating: title.ratingsSummary?.aggregateRating?.toString(),
		released:
			title.releaseDate?.year &&
			title.releaseDate.month &&
			title.releaseDate.day
				? new Date(
						Date.UTC(
							title.releaseDate.year,
							title.releaseDate.month - 1,
							title.releaseDate.day,
						),
					).toISOString()
				: undefined,
		runtime: title.runtime?.displayableProperty.value.plainText || undefined,
		videos: videos,
		behaviorHints: {
			defaultVideoId: !title.titleType?.canHaveEpisodes ? title.id : undefined,
			hasScheduledVideos,
		},
	};

	return meta;
}
