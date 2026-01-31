import { TMDB } from 'tmdb-ts';
import { env } from '@/env';
import { getWorkers } from '@/utils/runtime';

export function getTmdb() {
	let tmdb: TMDB | undefined;

	return async () => {
		const token = env.TMDB_TOKEN;

		if (await getWorkers()) {
			return new TMDB(token);
		}

		if (!tmdb) {
			tmdb = new TMDB(token);
		}

		return tmdb;
	};
}
