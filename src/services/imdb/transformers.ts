import type { ContentType, Link, MetaItem, Video } from 'stremio-types';
import type {
	AdvancedTitleSearchQuery,
	TitleQuery,
	TitlesQuery,
} from '@/generated/gql/graphql';
import type { ReqContext } from '@/lib/req-context';
import { ContentTypes } from 'stremio-types';
import { encodeSettings } from '@/lib/user-settings';
import { CinebetterCatalogs } from '@/services/manifest';
import { matchId } from '@/services/tmdb';

export type TitleIntersection = TitleQuery['title']
	& TitlesQuery['titles'][number]
	& NonNullable<
		NonNullable<
			AdvancedTitleSearchQuery['advancedTitleSearch']
		>['edges'][number]
	>['node']['title'];

type EpisodeEdge = NonNullable<
	NonNullable<TitleIntersection['episodes']>['episodes']
>['edges'][number];

function getTransportUrl(c: ReqContext) {
	const url = new URL(c.req.url);
	url.pathname = `/${encodeSettings(c.settings).toString()}/manifest.json`;
	return url.href;
}

async function getTmdbMatch(
	titleId: string,
	connection: string | undefined,
): Promise<[Awaited<ReturnType<typeof matchId>>, boolean]> {
	const tmdbMatch = await matchId(titleId, connection == null);
	if (tmdbMatch.every(m => m == null) && (connection != null)) {
		const connectionMatch = await matchId(connection, true);
		return [connectionMatch, true];
	}
	return [tmdbMatch, false];
}

function getConnectionId(
	title: Partial<TitleIntersection>,
): string | undefined {
	const firstLevelConnection = title.connections?.edges.find(c => c);
	if (!firstLevelConnection) {
		return undefined;
	}

	const secondLevelConnection
		= firstLevelConnection.node.associatedTitle.connections?.edges.find(c => c);
	if (secondLevelConnection) {
		return secondLevelConnection.node.associatedTitle.id;
	}

	return firstLevelConnection.node.associatedTitle.id;
}

function buildISOString(date: TitleIntersection['releaseDate']) {
	if (date?.year == null) {
		return;
	}

	return new Date(
		Date.UTC(date.year, (date.month ?? 12) - 1, date.day ?? 31),
	).toISOString();
}

function buildEpisodeVideo(
	titleId: string,
	episode: EpisodeEdge,
): Video | undefined {
	if (!episode?.node.titleText) {
		return;
	}

	const season = Number.parseInt(
		episode.node.series?.displayableEpisodeNumber.displayableSeason.text ?? '',
	);
	const episodeNumber = Number.parseInt(
		episode.node.series?.displayableEpisodeNumber.episodeNumber.text ?? '',
	);

	const released = buildISOString(episode.node.releaseDate);
	const overview = episode.node.plot?.plotText?.plainText;
	const thumbnail = episode.node.primaryImage?.url;

	return {
		id: [titleId, season, episodeNumber].join(':'),
		title: episode.node.titleText.text,
		...(released != null && { released }),
		...(overview != null && { overview }),
		...(thumbnail != null && { thumbnail }),
		season,
		episode: episodeNumber,
	};
}

function buildVideos(
	title: Partial<TitleIntersection>,
): Array<Video> | undefined {
	if (!title.titleType?.canHaveEpisodes || title.id == null) {
		return;
	}

	const episodes = title.episodes?.episodes?.edges;
	if (!episodes) {
		return;
	}

	return episodes
		.map(e => buildEpisodeVideo(title.id!, e))
		.filter(v => !!v);
}

function formatReleaseInfo(
	type: ContentType,
	releaseYear: TitleIntersection['releaseYear'],
) {
	if (releaseYear?.year == null) {
		return;
	}

	if (releaseYear.year === releaseYear.endYear || type === ContentTypes.MOVIE) {
		return releaseYear.year.toString();
	}

	return `${releaseYear.year}-${releaseYear.endYear ?? ''}`;
}

function buildCreditLinks(
	principalCredits: TitleIntersection['principalCredits'],
): Array<Link> {
	const categoryMap: Record<string, string> = {
		cast: 'Cast',
		director: 'Directors',
		writer: 'Writers',
	};

	return (
		(principalCredits ?? []).flatMap((p) => {
			const categoryId = p?.category.id;
			if (categoryId == null || categoryMap[categoryId] == null) {
				return [];
			}

			return (p?.credits ?? []).flatMap((c) => {
				const name = c?.name.nameText?.text;
				const map = categoryMap[categoryId];
				if (name == null || map == null) {
					return [];
				}

				return {
					name,
					category: map,
					url: `stremio:///search?search=${encodeURIComponent(name)}`,
				};
			});
		})
	);
}

function buildGenreLinks(
	genres: TitleIntersection['titleGenres'],
	type: ContentType,
	transportUrl: string,
): Array<Link> {
	return (
		genres?.genres.flatMap((g) => {
			if (!g) {
				return [];
			}

			return {
				name: g.genre.text,
				category: 'Genres',
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
	const stremioLinks: Array<Link> = [
		(title.ratingsSummary?.aggregateRating != null)
			? {
					name: title.ratingsSummary.aggregateRating.toString(),
					category: 'imdb',
					url: `https://imdb.com/title/${title.id}`,
				}
			: [],
		title.id != null && title.titleText?.text != null
			? {
					name: title.titleText.text,
					category: 'share',
					url: `https://www.strem.io/s/${type}/${title.id.split('tt')[1]}`,
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
	c: ReqContext,
	title: Partial<TitleIntersection>,
	matchTmdb: boolean,
	filterNoMatch: boolean,
) {
	if (title.id == null || ((title.titleText?.text) == null)) {
		return;
	}

	const type: ContentType = title.titleType?.canHaveEpisodes
		? ContentTypes.SERIES
		: ContentTypes.MOVIE;

	const connection = getConnectionId(title);

	const [tmdbMatch, matchedConnection] = matchTmdb
		? await getTmdbMatch(title.id, connection)
		: [undefined, false];

	const isLowQuality
		= c.settings.hideLowQuality
			&& filterNoMatch
			&& tmdbMatch?.every(m => m == null);

	if (matchTmdb && isLowQuality) {
		return;
	}

	const poster = title.primaryImage?.url;
	const description = title.plot?.plotText?.plainText;
	const releaseInfo = formatReleaseInfo(type, title.releaseYear);
	const runtime = title.runtime?.displayableProperty.value.plainText;
	const released = buildISOString(title.releaseDate);
	const imdbRating = title.ratingsSummary?.aggregateRating?.toString();
	const videos = buildVideos(title);

	const defaultVideoId = !title.titleType?.canHaveEpisodes
		? title.id
		: undefined;

	const hasScheduledVideos = !!(videos || []).find(v =>
		v.released != null ? new Date(v.released) > new Date() : false,
	);

	const meta: MetaItem = {
		id: title.id,
		type,
		name: title.titleText.text,
		...(poster != null && { poster }),
		background: `https://images.metahub.space/background/large/${matchedConnection ? connection : title.id}/img`,
		logo: `https://images.metahub.space/logo/large/${matchedConnection ? connection : title.id}/img`,
		...(description != null && { description }),
		...(releaseInfo != null && { releaseInfo }),
		...(runtime != null && { runtime }),
		...(released != null && { released }),
		posterShape: 'poster',
		...(imdbRating != null && { imdbRating }),
		links: buildLinks(title, type, getTransportUrl(c)),
		...(videos && { videos }),
		behaviorHints: {
			...(defaultVideoId != null && { defaultVideoId }),
			hasScheduledVideos,
		},
	};

	return meta;
}
