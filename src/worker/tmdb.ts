import { AppBindings, AppContext } from "./app";
import { isServerless } from "./lib/runtime";
import { getPrisma } from "./prisma";
import { env, getRuntimeKey } from "hono/adapter";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";
import { TMDB } from "tmdb-ts";

function getTmdb() {
	let tmdb: TMDB;

	return (c: AppContext) => {
		const token = env<AppBindings>(c, getRuntimeKey()).TMDB_TOKEN;
		if (!token) {
			throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
				message: "Error: TMDB_TOKEN is not defined in the environment.",
			});
		}

		if (isServerless()) {
			return new TMDB(token);
		}

		if (!tmdb) {
			tmdb = new TMDB(token);
		}

		return tmdb;
	};
}

export async function matchId(
	c: AppContext,
	imdbId: string,
	saveOnFail: boolean,
): Promise<[number | undefined, number | undefined]> {
	const prisma = getPrisma()(c);

	if (prisma) {
		const dbMatch = await prisma.imdbTmdb.findFirst({
			where: { imdb: { equals: imdbId } },
		});

		if (dbMatch) {
			switch (dbMatch.type) {
				case "M": {
					return [dbMatch.tmdb, undefined];
				}
				case "T": {
					return [undefined, dbMatch.tmdb];
				}
				case "N": {
					return [undefined, undefined];
				}
			}
		}
	}

	const results = await getTmdb()(c).find.byExternalId(imdbId, {
		external_source: "imdb_id",
	});
	const movieMatch = results.movie_results.find((r) => r)?.id;
	const tvMatch = results.tv_results.find((r) => r)?.id;

	if (prisma) {
		if (movieMatch) {
			await prisma.imdbTmdb.upsert({
				where: { imdb: imdbId },
				create: {
					imdb: imdbId,
					tmdb: movieMatch,
					type: "M",
				},
				update: {},
			});
		} else if (tvMatch) {
			await prisma.imdbTmdb.upsert({
				where: { imdb: imdbId },
				create: {
					imdb: imdbId,
					tmdb: tvMatch,
					type: "T",
				},
				update: {},
			});
		} else if (saveOnFail) {
			await prisma.imdbTmdb.upsert({
				where: { imdb: imdbId },
				create: { imdb: imdbId, tmdb: 0, type: "N" },
				update: {},
			});
		}
	}

	return [movieMatch, tvMatch];
}
