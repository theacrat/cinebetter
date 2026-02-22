import { TMDB } from "tmdb-ts";

import env from "@/env";
import getWorkers from "@/utils/runtime";

declare global {
	var __cinebetterTmdb: TMDB | undefined;
}

const getTmdb = async (): Promise<TMDB | undefined> => {
	const token = env.TMDB_TOKEN;

	if (token === undefined) {
		return undefined;
	}

	if (await getWorkers()) {
		return new TMDB(token);
	}

	globalThis.__cinebetterTmdb ??= new TMDB(token);

	return globalThis.__cinebetterTmdb;
};

export default getTmdb;
