import type { MetaItem } from 'stremio-types';
import type { TitleIntersection } from './transformers';
import type {
	AdvancedTitleSearchConstraints,
	AdvancedTitleSearchSort,
} from '@/generated/gql/graphql';
import type { ImdbClient } from '@/lib/imdb';
import type { ReqContext } from '@/lib/req-context';
import type { CinebetterCatalog, SupportedType } from '@/services/manifest';
import { ContentTypes, ExtraTypes } from 'stremio-types';
import {
	AdvancedTitleSearchSortBy,
	MainSearchTitleType,
	MainSearchType,
	SortOrder,
} from '@/generated/gql/graphql';
import { createClient } from '@/lib/imdb';
import { CinebetterCatalogs } from '@/services/manifest';
import { AdvancedTitleSearch } from './graphql/advanced-title-search';
import { isTitleEdge, Query } from './graphql/main-search';
import { Titles } from './graphql/titles';
import { buildTitle } from './transformers';

async function search(client: ImdbClient, query: string, type: SupportedType) {
	const result = await client.query(Query, {
		search: {
			type: [MainSearchType.Title],
			searchTerm: query,
			titleSearchOptions: {
				type: [
					type === ContentTypes.SERIES
						? MainSearchTitleType.Tv
						: MainSearchTitleType.Movie,
				],
			},
		},
	});

	const edges = result?.mainSearch?.edges.filter(isTitleEdge) || [];

	return edges.map(r => r.node.entity);
}

async function advancedSearch(
	client: ImdbClient,
	constraints: AdvancedTitleSearchConstraints,
	sort: AdvancedTitleSearchSort,
	skip: number,
) {
	const result = await client.query(AdvancedTitleSearch, {
		search: constraints,
		sort,
		first: 50,
		jumpToPosition: skip || undefined,
	});

	const edges = result?.advancedTitleSearch?.edges.filter(r => !!r) || [];

	return edges.map(r => r.node.title);
}

async function bulkTitles(
	client: ImdbClient,
	ids: Array<string>,
	episodeCount: number,
) {
	const results = await client.query(Titles, {
		ids,
		episodeCount,
	});

	if (results?.titles.length == null) {
		return [];
	}

	return results.titles.filter(t => !!t);
}

function buildConstraints(
	catalogId: 'top' | 'year' | 'imdbRating',
	type: SupportedType,
	discoverParam: string | undefined,
): AdvancedTitleSearchConstraints | undefined {
	const baseConstraints: AdvancedTitleSearchConstraints = {
		titleTypeConstraint: {
			anyTitleTypeIds:
				type === ContentTypes.SERIES
					? ['tvSeries', 'tvMiniSeries']
					: ['movie', 'short', 'tvSpecial', 'tvShort'],
		},
		languageConstraint: {
			anyLanguages: ['en', 'ja', 'ko', 'zh'],
		},
	};

	switch (catalogId) {
		case CinebetterCatalogs.POPULAR:
			return {
				...baseConstraints,
				...(discoverParam != null && {
					genreConstraint: {
						allGenreIds: [discoverParam],
					},
				}),
			};
		case CinebetterCatalogs.NEW:
			if (discoverParam == null) {
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
				...(discoverParam != null && {
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
	catalogId: 'top' | 'year' | 'imdbRating',
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
	c: ReqContext,
	catalogId: CinebetterCatalog,
	params: URLSearchParams,
	type: SupportedType,
): Promise<Array<MetaItem>> {
	const client = createClient(c.settings);

	let titles: Awaited<Array<Partial<TitleIntersection>>>;
	let matchTmdb = false;
	let filterNoMatch = false;

	switch (catalogId) {
		case CinebetterCatalogs.SEARCH: {
			const searchParam = params.get(ExtraTypes.SEARCH);
			if (searchParam == null) {
				return [];
			}
			titles = await search(client, searchParam, type);
			matchTmdb = true;
			filterNoMatch = true;
			break;
		}
		case CinebetterCatalogs.CALENDAR: {
			const calendarParam = params.get(ExtraTypes.CALENDARVIDEOSIDS);
			if (calendarParam == null) {
				return [];
			}
			titles = await bulkTitles(client, calendarParam.split(','), 10);
			break;
		}
		case CinebetterCatalogs.NOTIFICATIONS: {
			const notificationsParam = params.get(ExtraTypes.LASTVIDEOSIDS);
			if (notificationsParam == null) {
				return [];
			}
			titles = await bulkTitles(client, notificationsParam.split(','), 20);
			break;
		}
		case CinebetterCatalogs.POPULAR:
		case CinebetterCatalogs.NEW:
		case CinebetterCatalogs.FEATURED: {
			const discoverParam = params.get(ExtraTypes.GENRE);
			const normalisedDiscoverParam
				= discoverParam == null || discoverParam === 'All' ? undefined : discoverParam;
			const skipParam = Number.parseInt(params.get(ExtraTypes.SKIP) ?? '0');

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
		titles.map(async t => buildTitle(c, t, matchTmdb, filterNoMatch)),
	);

	return metas.filter(m => !!m);
}
