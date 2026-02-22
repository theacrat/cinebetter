import type { MetaItem } from "stremio-types";
import type { ReadonlyDeep } from "type-fest";

import { createClient } from "@/lib/imdb";
import type { ImdbClient } from "@/lib/imdb";
import type { ReqContext } from "@/lib/req-context";
import { buildTitle } from "@/services/imdb/transformers";
import type { TitleIntersection } from "@/services/imdb/transformers";
import type { CinebetterCatalog, SupportedType } from "@/services/manifest";
import { CinebetterCatalogs } from "@/services/manifest";

import runBrowseCatalogQuery from "./queries/browse";
import runCalendarCatalogQuery from "./queries/calendar";
import runNotificationsCatalogQuery from "./queries/notifications";
import runSearchCatalogQuery from "./queries/search";

interface CatalogQueryOptions {
	readonly catalogId: CinebetterCatalog;
	readonly client: ImdbClient;
	readonly queryParams: Readonly<URLSearchParams>;
	readonly type: SupportedType;
}

interface CatalogQueryResult {
	readonly filterNoMatch: boolean;
	readonly matchTmdb: boolean;
	readonly titles: Partial<TitleIntersection>[];
}

interface GetCatalogOptions {
	readonly catalogId: CinebetterCatalog;
	readonly context: ReadonlyDeep<ReqContext>;
	readonly queryParams: Readonly<URLSearchParams>;
	readonly type: SupportedType;
}

const isPresent = <TValue>(value: TValue): value is NonNullable<TValue> => value !== undefined;

const runCatalogQuery = ({
	catalogId,
	client,
	queryParams,
	type,
}: CatalogQueryOptions): Promise<CatalogQueryResult | undefined> | undefined => {
	switch (catalogId) {
		case CinebetterCatalogs.SEARCH: {
			return runSearchCatalogQuery({ client, queryParams, type });
		}
		case CinebetterCatalogs.CALENDAR: {
			return runCalendarCatalogQuery({ client, queryParams });
		}
		case CinebetterCatalogs.NOTIFICATIONS: {
			return runNotificationsCatalogQuery({ client, queryParams });
		}
		case CinebetterCatalogs.POPULAR:
		case CinebetterCatalogs.NEW:
		case CinebetterCatalogs.FEATURED: {
			return runBrowseCatalogQuery({ catalogId, client, queryParams, type });
		}
		default: {
			return undefined;
		}
	}
};

const getCatalog = async ({
	catalogId,
	context,
	queryParams,
	type,
}: GetCatalogOptions): Promise<ReadonlyDeep<MetaItem[]>> => {
	const client = createClient(context.settings);
	const queryResult = await runCatalogQuery({ catalogId, client, queryParams, type });
	if (!queryResult) {
		return [];
	}

	const metaPromises: Promise<ReadonlyDeep<MetaItem | undefined>>[] = queryResult.titles.map(
		async (title) =>
			buildTitle({
				context,
				filterNoMatch: queryResult.filterNoMatch,
				matchTmdb: queryResult.matchTmdb,
				title,
			}),
	);

	const metas = await Promise.all(metaPromises);
	return metas.filter((meta) => isPresent(meta));
};

export { getCatalog as default, type CatalogQueryResult };
