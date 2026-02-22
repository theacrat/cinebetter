import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import stripUndefined from "strip-undefined";

import env from "@/env";
import { PrismaClient } from "@/generated/prisma/client";
import getWorkers from "@/utils/runtime";

declare global {
	var __cinebetterPrisma: PrismaClient | undefined;
}

const getD1Prisma = (db: Readonly<D1Database>): PrismaClient => {
	const adapter = new PrismaD1(db);
	return new PrismaClient({ adapter });
};

const getSQLitePrisma = (url: string, authToken?: string): PrismaClient => {
	const adapter = new PrismaLibSql(
		stripUndefined<{ authToken?: string; url: string }>({
			authToken,
			url,
		}),
	);
	return new PrismaClient({ adapter });
};

const getPrisma = async (): Promise<PrismaClient | undefined> => {
	const workers = await getWorkers();
	const workersDb = workers?.env.IMDB_TMDB_D1;
	if (workersDb) {
		return getD1Prisma(workersDb);
	}

	const { SQLITE_DB, SQLITE_AUTH } = env;
	if (SQLITE_DB !== undefined) {
		globalThis.__cinebetterPrisma ??= getSQLitePrisma(SQLITE_DB, SQLITE_AUTH);
	}

	return globalThis.__cinebetterPrisma;
};

export default getPrisma;
