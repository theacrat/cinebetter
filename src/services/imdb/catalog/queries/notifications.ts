import { ExtraTypes } from "stremio-types";

import type { ImdbClient } from "@/lib/imdb";
import type { CatalogQueryResult } from "@/services/imdb/catalog";

import bulkTitles from "./bulk-titles";

const NOTIFICATIONS_EPISODE_COUNT = 20;

interface RunNotificationsCatalogQueryOptions {
	readonly client: ImdbClient;
	readonly queryParams: Readonly<URLSearchParams>;
}

const runNotificationsCatalogQuery = async ({
	client,
	queryParams,
}: RunNotificationsCatalogQueryOptions): Promise<CatalogQueryResult | undefined> => {
	const notificationsParam = queryParams.get(ExtraTypes.LASTVIDEOSIDS);
	if (typeof notificationsParam !== "string") {
		return undefined;
	}

	const titles = await bulkTitles({
		client,
		episodeCount: NOTIFICATIONS_EPISODE_COUNT,
		ids: notificationsParam.split(","),
	});
	return { filterNoMatch: false, matchTmdb: false, titles };
};

export default runNotificationsCatalogQuery;
