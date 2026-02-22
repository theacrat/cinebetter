import process from "node:process";

import { listLocalDatabases } from "@prisma/adapter-d1";
import { defineConfig } from "prisma/config";

const LAST_DB = -1;

const resolveDatasourceUrl = (): string => {
	if (process.env.CF === undefined) {
		return process.env.SQLITE_DB ?? "file:dev.db";
	}

	try {
		const [db] = listLocalDatabases().slice(LAST_DB);
		return `file:${db}`;
	} catch {
		return "";
	}
};

export default defineConfig({
	datasource: {
		url: resolveDatasourceUrl(),
	},
	schema: "schemas/prisma/schema.prisma",
});
