import { listLocalDatabases } from "@prisma/adapter-d1";
import { defineConfig } from "prisma/config";
import yn from "yn";

export default defineConfig({
	schema: "schemas/prisma/schema.prisma",
	datasource: {
		url: (() => {
			if (yn(import.meta.env.D1)) {
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
