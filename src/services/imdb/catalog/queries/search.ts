import { ContentTypes, ExtraTypes } from "stremio-types";
import type { ReadonlyDeep } from "type-fest";

import { MainSearchTitleType, MainSearchType } from "@/generated/gql/graphql";
import type { ImdbClient } from "@/lib/imdb";
import type { CatalogQueryResult } from "@/services/imdb/catalog";
import mainSearch from "@/services/imdb/graphql/main-search";
import type { DocumentData } from "@/services/imdb/graphql/types";
import type { SupportedType } from "@/services/manifest";

type MainSearchData = DocumentData<typeof mainSearch>;

type MainSearchEdge = NonNullable<MainSearchData["mainSearch"]>["edges"][number];

type TitleEntity = Extract<NonNullable<MainSearchEdge>["node"]["entity"], { __typename?: "Title" }>;

const isTitleEdge = (
	edge: MainSearchEdge,
): edge is NonNullable<MainSearchEdge> & {
	node: { entity: TitleEntity };
} => edge?.node.entity.__typename === "Title";

interface RunSearchCatalogQueryOptions {
	readonly client: ImdbClient;
	readonly queryParams: Readonly<URLSearchParams>;
	readonly type: SupportedType;
}

const runSearchCatalogQuery = async ({
	client,
	queryParams,
	type,
}: RunSearchCatalogQueryOptions): Promise<CatalogQueryResult | undefined> => {
	const searchParam = queryParams.get(ExtraTypes.SEARCH);
	if (typeof searchParam !== "string") {
		return undefined;
	}

	const result = await client.query(mainSearch, {
		search: {
			searchTerm: searchParam,
			titleSearchOptions: {
				type: [type === ContentTypes.SERIES ? MainSearchTitleType.Tv : MainSearchTitleType.Movie],
			},
			type: [MainSearchType.Title],
		},
	});

	const edges = result?.mainSearch?.edges.filter(isTitleEdge) ?? [];
	const titles = edges.map((edge: ReadonlyDeep<(typeof edges)[number]>) => edge.node.entity);
	return { filterNoMatch: true, matchTmdb: true, titles };
};

export default runSearchCatalogQuery;
