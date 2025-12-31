import {
	AdvancedTitleSearchConstraints,
	AdvancedTitleSearchSort,
	AdvancedTitleSearchSortBy,
	MainSearchTitleType,
	MainSearchType,
	SortOrder,
} from "../../generated/gql/graphql";
import { AppContext } from "../app";
import { ExtraType } from "../classes/StremioAddon";
import { StremioMeta, StremioType } from "../classes/StremioMeta";
import { CinebetterCatalogs } from "../manifest";
import { createClient, ImdbClient } from "./client";
import { AdvancedTitleSearch } from "./graphql/advanced-title-search";
import { Query, isTitleEdge } from "./graphql/main-search";
import { Titles } from "./graphql/titles";
import { buildTitle, TitleIntersection } from "./transformers";

async function search(client: ImdbClient, query: string, type: StremioType) {
	const result = await client.query(Query, {
		search: {
			type: [MainSearchType.Title],
			searchTerm: query,
			titleSearchOptions: {
				type: [
					type === StremioType.SERIES
						? MainSearchTitleType.Tv
						: MainSearchTitleType.Movie,
				],
			},
		},
	});

	const edges = result?.mainSearch?.edges?.filter(isTitleEdge) || [];

	return edges.map((r) => r.node.entity);
}

async function advancedSearch(
	client: ImdbClient,
	constraints: AdvancedTitleSearchConstraints,
	sort: AdvancedTitleSearchSort,
	skip: number,
) {
	const result = await client.query(AdvancedTitleSearch, {
		search: constraints,
		sort: sort,
		first: 50,
		jumpToPosition: skip || undefined,
	});

	const edges = result?.advancedTitleSearch?.edges?.filter((r) => !!r) || [];

	return edges.map((r) => r.node.title);
}

async function bulkTitles(
	client: ImdbClient,
	ids: string[],
	episodeCount: number,
) {
	const results = await client.query(Titles, {
		ids,
		episodeCount,
	});

	if (!results?.titles.length) {
		return [];
	}

	return results.titles.filter((t) => !!t);
}

function buildConstraints(
	catalogId: CinebetterCatalogs,
	type: StremioType,
	discoverParam: string | undefined,
): AdvancedTitleSearchConstraints | undefined {
	const baseConstraints: AdvancedTitleSearchConstraints = {
		titleTypeConstraint: {
			anyTitleTypeIds:
				type === StremioType.SERIES
					? ["tvSeries", "tvMiniSeries"]
					: ["movie", "short", "tvSpecial", "tvShort"],
		},
		languageConstraint: {
			anyLanguages: ["en", "ja", "ko", "zh"],
		},
	};

	switch (catalogId) {
		case CinebetterCatalogs.POPULAR:
			return {
				...baseConstraints,
				...(discoverParam && {
					genreConstraint: {
						allGenreIds: [discoverParam],
					},
				}),
			};
		case CinebetterCatalogs.NEW:
			if (!discoverParam) {
				return;
			}

			return {
				...baseConstraints,
				releaseDateConstraint: {
					releaseDateRange: {
						start: `${discoverParam}-01-01`,
						end: `${discoverParam}-12-31`,
					},
				},
			};
		case CinebetterCatalogs.FEATURED:
			return {
				...baseConstraints,
				...(discoverParam && {
					genreConstraint: {
						allGenreIds: [discoverParam],
					},
				}),
				userRatingsConstraint: {
					ratingsCountRange: { min: 2000 },
					aggregateRatingRange: { min: 6.5 },
				},
			};
	}
}

function getSort(
	catalogId: CinebetterCatalogs,
): AdvancedTitleSearchSort | undefined {
	switch (catalogId) {
		case CinebetterCatalogs.POPULAR:
		case CinebetterCatalogs.NEW:
			return {
				sortBy: AdvancedTitleSearchSortBy.Popularity,
				sortOrder: SortOrder.Asc,
			};
		case CinebetterCatalogs.FEATURED:
			return {
				sortBy: AdvancedTitleSearchSortBy.UserRating,
				sortOrder: SortOrder.Asc,
			};
	}
}

export async function getCatalog(
	c: AppContext,
	transportUrl: string,
	catalogId: CinebetterCatalogs,
	params: URLSearchParams,
	type: StremioType,
): Promise<StremioMeta[]> {
	const client = createClient(c.var.settings);

	let titles: Awaited<Partial<TitleIntersection>[]>;
	let matchTmdb = false;
	let filterNoMatch = false;

	switch (catalogId) {
		case CinebetterCatalogs.SEARCH: {
			const searchParam = params.get(ExtraType.SEARCH);
			if (!searchParam) {
				return [];
			}
			titles = await search(client, searchParam, type);
			matchTmdb = true;
			filterNoMatch = true;
			break;
		}
		case CinebetterCatalogs.CALENDAR: {
			const calendarParam = params.get(ExtraType.CALENDAR);
			if (!calendarParam) {
				return [];
			}
			titles = await bulkTitles(client, calendarParam.split(","), 10);
			break;
		}
		case CinebetterCatalogs.NOTIFICATIONS: {
			const notificationsParam = params.get(ExtraType.NOTIFICATION);
			if (!notificationsParam) {
				return [];
			}
			titles = await bulkTitles(client, notificationsParam.split(","), 20);
			break;
		}
		case CinebetterCatalogs.POPULAR:
		case CinebetterCatalogs.NEW:
		case CinebetterCatalogs.FEATURED: {
			const discoverParam = params.get(ExtraType.DISCOVER);
			const normalisedDiscoverParam =
				!discoverParam || discoverParam === "All" ? undefined : discoverParam;
			const skipParam = parseInt(params.get(ExtraType.SKIP) || "0");

			const constraints = buildConstraints(
				catalogId,
				type,
				normalisedDiscoverParam,
			);
			const sort = getSort(catalogId);

			if (!constraints || !sort) {
				return [];
			}

			titles = await advancedSearch(client, constraints, sort, skipParam);
			break;
		}
	}

	const metas = await Promise.all(
		titles.map((t) => buildTitle(c, transportUrl, t, matchTmdb, filterNoMatch)),
	);

	return metas.filter((m) => !!m);
}
