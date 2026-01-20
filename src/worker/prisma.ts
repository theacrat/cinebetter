import { PrismaClient } from "../generated/prisma/client";
import { AppBindings, AppContext } from "./app";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { env } from "hono/adapter";

function getD1Prisma(db: D1Database) {
	const adapter = new PrismaD1(db);
	return new PrismaClient({ adapter });
}

function getSQLitePrisma(url: string, authToken?: string) {
	const adapter = new PrismaLibSql({ url, authToken });
	return new PrismaClient({ adapter });
}

export function getPrisma() {
	let prisma: PrismaClient;

	return (c: AppContext) => {
		const { IMDB_TMDB_D1, SQLITE_DB, SQLITE_AUTH } = env<AppBindings>(c);

		if (IMDB_TMDB_D1) {
			return getD1Prisma(IMDB_TMDB_D1);
		}

		if (SQLITE_DB) {
			if (!prisma) {
				prisma = getSQLitePrisma(SQLITE_DB, SQLITE_AUTH);
			}
			return prisma;
		}
	};
}
