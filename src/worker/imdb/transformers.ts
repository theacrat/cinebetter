import type {
	AdvancedTitleSearchQuery,
	TitleQuery,
	TitlesQuery,
} from "../../generated/gql/graphql";
import { AppContext } from "../app";
import {
	Link,
	PosterShape,
	StremioMeta,
	StremioType,
	Video,
} from "../classes/StremioMeta";
import { CinebetterCatalogs } from "../manifest";
import { matchId } from "../tmdb";

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
	if (!episode?.node.titleText || !episode?.node.releaseDate?.year) {
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
		released: new Date(
			Date.UTC(
				episode.node.releaseDate.year,
				episode.node.releaseDate.month || 11,
				episode.node.releaseDate.day || 31,
			),
		),
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

function formatAwards(
	awardNominations: TitleIntersection["awardNominations"],
): string | undefined {
	if (!awardNominations?.edges.length) {
		return undefined;
	}

	const wins = awardNominations.edges.filter((a) => a?.node.isWinner).length;
	const noms = awardNominations.edges.length - wins;

	const winStr = (() => {
		if (!wins) {
			return "";
		} else if (wins === 1) {
			return "1 win";
		} else {
			return `${wins} wins`;
		}
	})();

	const nomStr = (() => {
		if (!noms) {
			return "";
		}
		if (noms === 1) {
			return "1 nomination";
		} else {
			return `${noms} nominations`;
		}
	})();

	if (winStr && nomStr) {
		return `${winStr} & ${nomStr} total`;
	}
	return `${winStr || nomStr} total`;
}

function formatReleaseInfo(
	type: StremioType,
	releaseYear: TitleIntersection["releaseYear"],
): string | undefined {
	if (!releaseYear?.year) {
		return;
	}

	if (releaseYear.year === releaseYear.endYear || type === StremioType.MOVIE) {
		return releaseYear.year.toString();
	}

	return `${releaseYear.year}-${releaseYear.endYear || ""}`;
}

function findOfficialWebsite(
	externalLinks: TitleIntersection["externalLinks"],
): string | undefined {
	return (
		externalLinks?.edges.find((w) => w?.node.label === "Official site")?.node
			.url || externalLinks?.edges.find((w) => w)?.node.url
	);
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
	type: StremioType,
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
	type: StremioType,
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
	transportUrl: string,
	title: Partial<TitleIntersection>,
	matchTmdb: boolean,
	filterNoMatch: boolean,
) {
	if (!title.id || !title.titleText?.text) {
		return;
	}

	const type = title.titleType?.canHaveEpisodes
		? StremioType.SERIES
		: StremioType.MOVIE;

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

	const meta: StremioMeta = {
		id: title.id,
		type: type,
		name: title.titleText.text,
		posterShape: PosterShape.POSTER,
		background: `https://images.metahub.space/background/large/${matchedConnection ? connection : title.id}/img`,
		logo: `https://images.metahub.space/logo/large/${matchedConnection ? connection : title.id}/img`,
		genres: title.titleGenres?.genres.flatMap((g) => g?.genre.text || []),
		poster: title.primaryImage?.url || undefined,
		description: title.plot?.plotText?.plainText || undefined,
		releaseInfo: formatReleaseInfo(type, title.releaseYear),
		links: buildLinks(title, type, transportUrl),
		imdbRating: title.ratingsSummary?.aggregateRating?.toString(),
		released:
			title.releaseDate?.year &&
			title.releaseDate.month &&
			title.releaseDate.day
				? new Date(
						Date.UTC(
							title.releaseDate.year,
							title.releaseDate.month,
							title.releaseDate.day,
						),
					)
				: undefined,
		runtime: title.runtime?.displayableProperty.value.plainText || undefined,
		language: title.spokenLanguages?.spokenLanguages
			.flatMap((l) => l?.text || [])
			.join(", "),
		country: title.countriesOfOrigin?.countries
			?.flatMap((c) => c?.text || [])
			.join(", "),
		awards: formatAwards(title.awardNominations),
		videos: videos,
		website: findOfficialWebsite(title.externalLinks),
		behaviorHints: !title.titleType?.canHaveEpisodes
			? { defaultVideoId: title.id }
			: undefined,
	};

	return meta;
}
