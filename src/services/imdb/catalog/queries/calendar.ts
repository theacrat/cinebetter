import { ExtraTypes } from "stremio-types";

import type { ImdbClient } from "@/lib/imdb";
import type { CatalogQueryResult } from "@/services/imdb/catalog";

import bulkTitles from "./bulk-titles";

const CALENDAR_EPISODE_COUNT = 10;

interface RunCalendarCatalogQueryOptions {
	readonly client: ImdbClient;
	readonly queryParams: Readonly<URLSearchParams>;
}

const runCalendarCatalogQuery = async ({
	client,
	queryParams,
}: RunCalendarCatalogQueryOptions): Promise<CatalogQueryResult | undefined> => {
	const calendarParam = queryParams.get(ExtraTypes.CALENDARVIDEOSIDS);
	if (typeof calendarParam !== "string") {
		return undefined;
	}

	const titles = await bulkTitles({
		client,
		episodeCount: CALENDAR_EPISODE_COUNT,
		ids: calendarParam.split(","),
	});
	return { filterNoMatch: false, matchTmdb: false, titles };
};

export default runCalendarCatalogQuery;
