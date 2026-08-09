import type { ContentType, Link, MetaItem, Video } from "stremio-types";
import { ContentTypes } from "stremio-types";
import stripUndefined from "strip-undefined";
import type { ReadonlyDeep } from "type-fest";

import type { ReqContext } from "@/lib/req-context";
import { encodeSettings } from "@/lib/user-settings";
import { CinebetterCatalogs } from "@/services/manifest";
import matchId from "@/services/tmdb";

import type titleFull from "./graphql/title-full";
import type { DocumentData } from "./graphql/types";

const DEFAULT_DAY = 31;
const DEFAULT_MONTH = 12;
const MONTH_OFFSET = 1;
const SEARCH_ID_SUFFIX_INDEX = 1;

type TitleFullData = DocumentData<typeof titleFull>;
type TitleFromFull = NonNullable<TitleFullData["title"]>;
type TitleIntersection = ReadonlyDeep<TitleFromFull>;
type EpisodeEdge = NonNullable<
	NonNullable<NonNullable<TitleIntersection["episodes"]>["episodes"]>["edges"][number]
>;

interface BuildTitleOptions {
	readonly context: ReqContext;
	readonly filterNoMatch: boolean;
	readonly matchTmdb: boolean;
	readonly title: Partial<TitleIntersection>;
}

interface TmdbMatchResult {
	readonly imageId: string;
	readonly isLowQuality: boolean;
}

interface ResolveTmdbResultOptions {
	readonly connectionId: string | undefined;
	readonly context: ReqContext;
	readonly filterNoMatch: boolean;
	readonly matchTmdb: boolean;
	readonly title: Partial<TitleIntersection>;
}

const getTransportUrl = (context: ReadonlyDeep<ReqContext>): string => {
	const requestUrl = new URL(context.req.url);
	const manifestPath = `/${encodeSettings(context.settings).toString()}/manifest.json`;
	return new URL(manifestPath, requestUrl).href;
};

const getTmdbMatch = async (
	titleId: string,
	connectionId: string | undefined,
): Promise<[Awaited<ReturnType<typeof matchId>>, boolean]> => {
	const tmdbMatch = await matchId(titleId, connectionId === undefined);
	if (tmdbMatch === undefined && connectionId !== undefined) {
		const connectionMatch = await matchId(connectionId, true);
		return [connectionMatch, true];
	}
	return [tmdbMatch, false];
};

const getConnectionId = (title: Partial<TitleIntersection>): string | undefined => {
	const firstLevelEdges = title.connections?.edges;
	if (firstLevelEdges === undefined) {
		return undefined;
	}

	const firstLevelConnection: (typeof firstLevelEdges)[number] | undefined = firstLevelEdges.find(
		(edge) => edge !== null,
	);

	if (firstLevelConnection === undefined) {
		return undefined;
	}

	const secondLevelEdges = firstLevelConnection.node.associatedTitle.connections?.edges;
	if (secondLevelEdges !== undefined) {
		for (const edge of secondLevelEdges) {
			if (edge !== null) {
				return edge.node.associatedTitle.id;
			}
		}
	}

	return firstLevelConnection.node.associatedTitle.id;
};

const buildISOString = (date?: TitleIntersection["releaseDate"]): string | undefined => {
	if (typeof date?.year !== "number") {
		return undefined;
	}

	return new Date(
		Date.UTC(date.year, (date.month ?? DEFAULT_MONTH) - MONTH_OFFSET, date.day ?? DEFAULT_DAY),
	).toISOString();
};

const buildEpisodeVideo = (titleId: string, episode: EpisodeEdge): Video | undefined => {
	if (episode.node.titleText === null) {
		return undefined;
	}

	const season = Number.parseInt(
		episode.node.series?.displayableEpisodeNumber.displayableSeason.text ?? "",
		10,
	);
	const episodeNumber = Number.parseInt(
		episode.node.series?.displayableEpisodeNumber.episodeNumber.text ?? "",
		10,
	);

	const released = buildISOString(episode.node.releaseDate);
	const overview = episode.node.plot?.plotText?.plainText ?? undefined;
	const thumbnail = episode.node.primaryImage?.url ?? undefined;

	return stripUndefined<Video>({
		episode: episodeNumber,
		id: [titleId, season, episodeNumber].join(":"),
		overview,
		released,
		season,
		thumbnail,
		title: episode.node.titleText.text,
	});
};

const buildVideos = (title: Partial<TitleIntersection>): Video[] | undefined => {
	const { id } = title;
	if (title.titleType?.canHaveEpisodes !== true || typeof id !== "string") {
		return undefined;
	}

	const episodes = title.episodes?.episodes?.edges;
	if (episodes === undefined) {
		return undefined;
	}

	return episodes.flatMap((episode) => {
		if (episode === null) {
			return [];
		}

		const video = buildEpisodeVideo(id, episode);
		return video === undefined ? [] : [video];
	});
};

const formatReleaseInfo = (
	type: ContentType,
	releaseYear?: TitleIntersection["releaseYear"],
): string | undefined => {
	if (typeof releaseYear?.year !== "number") {
		return undefined;
	}

	if (releaseYear.year === releaseYear.endYear || type === ContentTypes.MOVIE) {
		return releaseYear.year.toString();
	}

	return `${releaseYear.year}-${releaseYear.endYear ?? ""}`;
};

const buildCreditLinks = (principalCredits?: TitleIntersection["principalCredits"]): Link[] => {
	const categoryMap: Readonly<Record<string, string>> = {
		cast: "Cast",
		director: "Directors",
		writer: "Writers",
	};

	return (principalCredits ?? []).flatMap((principal) => {
		const categoryId = principal?.category.id;
		if (categoryId === undefined || categoryMap[categoryId] === undefined) {
			return [];
		}

		const mappedCategory = categoryMap[categoryId];
		return (principal?.credits ?? []).flatMap((credit) => {
			const name = credit?.name.nameText?.text;
			return name === undefined
				? []
				: [
						{
							category: mappedCategory,
							name,
							url: `stremio:///search?search=${encodeURIComponent(name)}`,
						},
					];
		});
	});
};

const buildGenreLinks = (
	type: ContentType,
	transportUrl: string,
	genres?: TitleIntersection["titleGenres"],
): Link[] =>
	(genres?.genres ?? []).flatMap((genre) => {
		const name = genre?.genre.text;
		return typeof name === "string"
			? [
					{
						category: "Genres",
						name,
						url: `stremio:///discover/${encodeURIComponent(transportUrl)}/${type}/${CinebetterCatalogs.POPULAR}?genre=${name}`,
					},
				]
			: [];
	});

const buildLinks = (
	title: Partial<TitleIntersection>,
	type: ContentType,
	transportUrl: string,
): Link[] => {
	const searchSuffix = title.id?.split("tt")[SEARCH_ID_SUFFIX_INDEX];

	const imdbLink: Link[] =
		typeof title.ratingsSummary?.aggregateRating === "number"
			? [
					{
						category: "imdb",
						name: title.ratingsSummary.aggregateRating.toString(),
						url: `https://imdb.com/title/${title.id}`,
					},
				]
			: [];
	const shareLink: Link[] =
		title.id !== undefined && title.titleText?.text !== undefined && searchSuffix !== undefined
			? [
					{
						category: "share",
						name: title.titleText.text,
						url: `https://www.strem.io/s/${type}/${searchSuffix}`,
					},
				]
			: [];

	return [
		...imdbLink,
		...shareLink,
		...buildGenreLinks(type, transportUrl, title.titleGenres),
		...buildCreditLinks(title.principalCredits),
	];
};

const hasScheduledVideos = (videos: ReadonlyDeep<readonly Video[] | undefined>): boolean => {
	for (const video of videos ?? []) {
		if (typeof video.released === "string" && new Date(video.released) > new Date()) {
			return true;
		}
	}

	return false;
};

const resolveTmdbResult = async ({
	connectionId,
	context,
	filterNoMatch,
	matchTmdb,
	title,
}: ReadonlyDeep<ResolveTmdbResultOptions>): Promise<TmdbMatchResult> => {
	if (!matchTmdb || title.id === undefined) {
		return { imageId: title.id ?? "", isLowQuality: false };
	}

	const [tmdbMatch, matchedConnection] = await getTmdbMatch(title.id, connectionId);
	const isLowQuality = context.settings.hideLowQuality && filterNoMatch && tmdbMatch === undefined;
	const imageId = matchedConnection && connectionId !== undefined ? connectionId : title.id;
	return { imageId, isLowQuality };
};

const buildTitle = async ({
	context,
	filterNoMatch,
	matchTmdb,
	title,
}: ReadonlyDeep<BuildTitleOptions>): Promise<MetaItem | undefined> => {
	if (title.id === undefined || title.titleText?.text === undefined) {
		return undefined;
	}

	const type: ContentType =
		title.titleType?.canHaveEpisodes === true ? ContentTypes.SERIES : ContentTypes.MOVIE;
	const connectionId = getConnectionId(title);
	const tmdbResult = await resolveTmdbResult({
		connectionId,
		context,
		filterNoMatch,
		matchTmdb,
		title,
	});

	if (tmdbResult.isLowQuality) {
		return undefined;
	}

	const videos = buildVideos(title);
	const defaultVideoId = title.titleType?.canHaveEpisodes === true ? undefined : title.id;

	return stripUndefined<MetaItem>({
		background: `https://images.metahub.space/background/large/${tmdbResult.imageId}/img`,
		behaviorHints: {
			defaultVideoId,
			hasScheduledVideos: hasScheduledVideos(videos),
		},
		description: title.plot?.plotText?.plainText ?? undefined,
		id: title.id,
		imdbRating: title.ratingsSummary?.aggregateRating?.toString(),
		links: buildLinks(title, type, getTransportUrl(context)),
		logo: `https://images.metahub.space/logo/large/${tmdbResult.imageId}/img`,
		name: title.titleText.text,
		poster: title.primaryImage?.url,
		posterShape: "poster",
		releaseInfo: formatReleaseInfo(type, title.releaseYear),
		released: buildISOString(title.releaseDate),
		runtime: title.runtime?.displayableProperty.value.plainText ?? undefined,
		type,
		videos,
	});
};

export { buildTitle, type TitleIntersection };
