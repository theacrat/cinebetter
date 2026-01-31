import { getPrisma } from '@/lib/prisma';
import { getTmdb } from '@/lib/tmdb';

export async function matchId(
	imdbId: string,
	saveOnFail: boolean,
): Promise<[number | undefined, number | undefined]> {
	const prisma = await getPrisma()();

	if (prisma) {
		const dbMatch = await prisma.imdbTmdb.findFirst({
			where: { imdb: { equals: imdbId } },
		});

		if (dbMatch) {
			switch (dbMatch.type) {
				case 'M': {
					return [dbMatch.tmdb, undefined];
				}
				case 'T': {
					return [undefined, dbMatch.tmdb];
				}
				case 'N': {
					return [undefined, undefined];
				}
			}
		}
	}

	const tmdb = await getTmdb()();

	const results = await tmdb.find.byExternalId(imdbId, {
		external_source: 'imdb_id',
	});
	const movieMatch = results.movie_results[0]?.id;
	const tvMatch = results.tv_results[0]?.id;

	if (prisma) {
		if (movieMatch != null) {
			await prisma.imdbTmdb.upsert({
				where: { imdb: imdbId },
				create: {
					imdb: imdbId,
					tmdb: movieMatch,
					type: 'M',
				},
				update: {},
			});
		}
		else if (tvMatch != null) {
			await prisma.imdbTmdb.upsert({
				where: { imdb: imdbId },
				create: {
					imdb: imdbId,
					tmdb: tvMatch,
					type: 'T',
				},
				update: {},
			});
		}
		else if (saveOnFail) {
			await prisma.imdbTmdb.upsert({
				where: { imdb: imdbId },
				create: {
					imdb: imdbId,
					tmdb: 0,
					type: 'N',
				},
				update: {},
			});
		}
	}

	return [movieMatch, tvMatch];
}
