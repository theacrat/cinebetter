import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { env } from '@/env';
import { PrismaClient } from '@/generated/prisma/client';
import { getWorkers } from '@/utils/runtime';

function getD1Prisma(db: D1Database) {
	const adapter = new PrismaD1(db);
	return new PrismaClient({ adapter });
}

function getSQLitePrisma(url: string, authToken?: string) {
	const adapter = new PrismaLibSql({ url, ...(authToken != null && { authToken }) });
	return new PrismaClient({ adapter });
}

export function getPrisma() {
	let prisma: PrismaClient | undefined;

	return async () => {
		const workers = await getWorkers();
		if (workers) {
			const { IMDB_TMDB_D1 } = workers.env;
			return getD1Prisma(IMDB_TMDB_D1);
		}

		const { SQLITE_DB, SQLITE_AUTH } = env;
		if (SQLITE_DB != null) {
			if (!prisma) {
				prisma = getSQLitePrisma(SQLITE_DB, SQLITE_AUTH);
			}
			return prisma;
		}

		return undefined;
	};
}
