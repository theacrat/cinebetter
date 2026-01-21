import { listLocalDatabases } from "@prisma/adapter-d1";
import { defineConfig } from "prisma/config";

export default defineConfig({
	schema: "schemas/prisma/schema.prisma",
	datasource: {
		url: (() => {
			if (import.meta.env.D1 !== undefined) {
				try {
					const db = listLocalDatabases().pop();
					return `file:${db}`;
				} catch {
					console.error("Failed to get Miniflare DB, try bun db:create");
				}
			} else if (import.meta.env.SQLITE_DB) {
				return import.meta.env.SQLITE_DB;
			}

			return "file:";
		})(),
	},
});
