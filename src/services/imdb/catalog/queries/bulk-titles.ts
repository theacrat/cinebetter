import type { ImdbClient } from "@/lib/imdb";
import titlesQuery from "@/services/imdb/graphql/titles";
import type { DocumentData } from "@/services/imdb/graphql/types";

type TitlesData = DocumentData<typeof titlesQuery>;
type QueriedTitle = NonNullable<TitlesData["titles"][number]>;

const isPresent = <TValue>(value: TValue): value is NonNullable<TValue> => value !== undefined;

interface BulkTitlesOptions {
	readonly client: ImdbClient;
	readonly episodeCount: number;
	readonly ids: readonly string[];
}

const bulkTitles = async ({
	client,
	episodeCount,
	ids,
}: BulkTitlesOptions): Promise<QueriedTitle[]> => {
	const result = await client.query(titlesQuery, {
		episodeCount,
		ids: [...ids],
	});

	if (result?.titles.length === undefined) {
		return [];
	}

	return result.titles.filter(isPresent);
};

export default bulkTitles;
