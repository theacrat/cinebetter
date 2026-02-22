import { ContentTypes, ExtraTypes } from "stremio-types";

import type {
	AdvancedTitleSearchConstraints,
	AdvancedTitleSearchSort,
} from "@/generated/gql/graphql";
import { AdvancedTitleSearchSortBy, SortOrder } from "@/generated/gql/graphql";
import type { ImdbClient } from "@/lib/imdb";
import type { CatalogQueryResult } from "@/services/imdb/catalog";
import advancedTitleSearch from "@/services/imdb/graphql/advanced-title-search";
import type { DocumentData } from "@/services/imdb/graphql/types";
import type { SupportedType } from "@/services/manifest";
import { CinebetterCatalogs } from "@/services/manifest";

const DISCOVER_ALL_VALUE = "All";
const EMPTY_SKIP_POSITION = 0;
const EMPTY_SKIP_VALUE = "0";
const FEATURED_MIN_RATING = 6.5;
const FEATURED_MIN_RATING_COUNT = 2000;
const FIRST_SEARCH_RESULTS = 50;

type AdvancedSearchData = DocumentData<typeof advancedTitleSearch>;
type BroadCatalogId =
	| typeof CinebetterCatalogs.POPULAR
	| typeof CinebetterCatalogs.NEW
	| typeof CinebetterCatalogs.FEATURED;

type AdvancedTitle = NonNullable<
	NonNullable<AdvancedSearchData["advancedTitleSearch"]>["edges"][number]
>["node"]["title"];

const isPresent = <TValue>(value: TValue): value is NonNullable<TValue> => value !== undefined;

const normaliseDiscoverParam = (value?: string | null): string | undefined => {
	if (typeof value !== "string" || value === DISCOVER_ALL_VALUE) {
		return undefined;
	}
	return value;
};

const buildBaseConstraints = (type: SupportedType): AdvancedTitleSearchConstraints => ({
	languageConstraint: {
		anyLanguages: ["en", "ja", "ko", "zh"],
	},
	titleTypeConstraint: {
		anyTitleTypeIds:
			type === ContentTypes.SERIES
				? ["tvSeries", "tvMiniSeries"]
				: ["movie", "short", "tvSpecial", "tvShort"],
	},
});

const buildConstraints = (
	catalogId: BroadCatalogId,
	type: SupportedType,
	discoverParam: string | undefined,
): AdvancedTitleSearchConstraints | undefined => {
	const baseConstraints = buildBaseConstraints(type);

	switch (catalogId) {
		case CinebetterCatalogs.POPULAR: {
			return {
				...baseConstraints,
				genreConstraint: discoverParam === undefined ? undefined : { allGenreIds: [discoverParam] },
			};
		}
		case CinebetterCatalogs.NEW: {
			if (discoverParam === undefined) {
				return undefined;
			}

			return {
				...baseConstraints,
				releaseDateConstraint: {
					releaseDateRange: {
						end: `${discoverParam}-12-31`,
						start: `${discoverParam}-01-01`,
					},
				},
			};
		}
		case CinebetterCatalogs.FEATURED: {
			return {
				...baseConstraints,
				genreConstraint: discoverParam === undefined ? undefined : { allGenreIds: [discoverParam] },
				userRatingsConstraint: {
					aggregateRatingRange: { min: FEATURED_MIN_RATING },
					ratingsCountRange: { min: FEATURED_MIN_RATING_COUNT },
				},
			};
		}
		default: {
			return undefined;
		}
	}
};

const getSort = (catalogId: BroadCatalogId): AdvancedTitleSearchSort | undefined => {
	switch (catalogId) {
		case CinebetterCatalogs.POPULAR:
		case CinebetterCatalogs.NEW: {
			return {
				sortBy: AdvancedTitleSearchSortBy.Popularity,
				sortOrder: SortOrder.Asc,
			};
		}
		case CinebetterCatalogs.FEATURED: {
			return {
				sortBy: AdvancedTitleSearchSortBy.UserRating,
				sortOrder: SortOrder.Asc,
			};
		}
		default: {
			return undefined;
		}
	}
};

interface AdvancedSearchOptions {
	readonly client: ImdbClient;
	readonly constraints: AdvancedTitleSearchConstraints;
	readonly skip: number;
	readonly sort: AdvancedTitleSearchSort;
}

const advancedSearch = async ({
	client,
	constraints,
	skip,
	sort,
}: AdvancedSearchOptions): Promise<AdvancedTitle[]> => {
	const result = await client.query(advancedTitleSearch, {
		first: FIRST_SEARCH_RESULTS,
		jumpToPosition: skip > EMPTY_SKIP_POSITION ? skip : undefined,
		search: constraints,
		sort,
	});

	const edges = result?.advancedTitleSearch?.edges.filter(isPresent) ?? [];
	const titles = edges.map((edge) => edge.node.title);

	return titles;
};

interface RunBrowseCatalogQueryOptions {
	readonly catalogId: BroadCatalogId;
	readonly client: ImdbClient;
	readonly queryParams: Readonly<URLSearchParams>;
	readonly type: SupportedType;
}

const runBrowseCatalogQuery = async ({
	catalogId,
	client,
	queryParams,
	type,
}: RunBrowseCatalogQueryOptions): Promise<CatalogQueryResult | undefined> => {
	const discoverParam = normaliseDiscoverParam(queryParams.get(ExtraTypes.GENRE));
	const skip = Number.parseInt(queryParams.get(ExtraTypes.SKIP) ?? EMPTY_SKIP_VALUE, 10);
	const constraints = buildConstraints(catalogId, type, discoverParam);
	const sort = getSort(catalogId);

	if (constraints === undefined || sort === undefined) {
		return undefined;
	}

	const titles = await advancedSearch({ client, constraints, skip, sort });
	return { filterNoMatch: false, matchTmdb: false, titles };
};

export default runBrowseCatalogQuery;
