import getPrisma from "@/lib/prisma";
import getTmdb from "@/lib/tmdb";

interface ExternalMatches {
	readonly movieMatch: number | undefined;
	readonly tvMatch: number | undefined;
}

const getCachedMatch = async (imdbId: string): Promise<number | undefined> => {
	const prisma = await getPrisma();
	if (prisma === undefined) {
		return undefined;
	}

	const dbMatch = await prisma.imdbTmdb.findFirst({
		where: { imdb: { equals: imdbId } },
	});
	if (dbMatch === null) {
		return undefined;
	}

	if (dbMatch.type === "N") {
		return undefined;
	}

	return dbMatch.tmdb;
};

const getExternalMatches = async (imdbId: string): Promise<ExternalMatches | undefined> => {
	const tmdb = await getTmdb();
	if (!tmdb) {
		return undefined;
	}

	const results = await tmdb.find.byExternalId(imdbId, {
		external_source: "imdb_id",
	});

	return {
		movieMatch: results.movie_results.find(Boolean)?.id,
		tvMatch: results.tv_results.find(Boolean)?.id,
	};
};

const upsertMatch = async ({
	imdbId,
	match,
	type,
}: Readonly<{
	imdbId: string;
	match: number;
	type: "M" | "T";
}>): Promise<void> => {
	const prisma = await getPrisma();
	if (prisma === undefined) {
		return;
	}

	await prisma.imdbTmdb.upsert({
		create: {
			imdb: imdbId,
			tmdb: match,
			type,
		},
		update: {},
		where: { imdb: imdbId },
	});
};

const upsertNoMatch = async (imdbId: string): Promise<void> => {
	const prisma = await getPrisma();
	if (prisma === undefined) {
		return;
	}

	await prisma.imdbTmdb.upsert({
		create: {
			imdb: imdbId,
			tmdb: 0,
			type: "N",
		},
		update: {},
		where: { imdb: imdbId },
	});
};

const persistMatch = async ({
	imdbId,
	movieMatch,
	saveOnFail,
	tvMatch,
}: Readonly<{
	imdbId: string;
	movieMatch: number | undefined;
	saveOnFail: boolean;
	tvMatch: number | undefined;
}>): Promise<void> => {
	if (typeof movieMatch === "number") {
		await upsertMatch({ imdbId, match: movieMatch, type: "M" });
		return;
	}

	if (typeof tvMatch === "number") {
		await upsertMatch({ imdbId, match: tvMatch, type: "T" });
		return;
	}

	if (!saveOnFail) {
		return;
	}

	await upsertNoMatch(imdbId);
};

const matchId = async (imdbId: string, saveOnFail: boolean): Promise<number | undefined> => {
	const cachedMatch = await getCachedMatch(imdbId);
	if (cachedMatch !== undefined) {
		return cachedMatch;
	}

	const matches = await getExternalMatches(imdbId);
	if (!matches) {
		return undefined;
	}

	const { movieMatch, tvMatch } = matches;

	await persistMatch({
		imdbId,
		movieMatch,
		saveOnFail,
		tvMatch,
	});

	return movieMatch ?? tvMatch ?? undefined;
};

export default matchId;
