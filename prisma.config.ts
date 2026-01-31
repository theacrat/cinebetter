import process from 'node:process';
import { listLocalDatabases } from '@prisma/adapter-d1';
import { defineConfig } from 'prisma/config';

export default defineConfig({
	schema: 'schemas/prisma/schema.prisma',
	datasource: {
		url: (() => {
			if (process.env.CF == null) {
				return process.env.SQLITE_DB ?? 'file:dev.db';
			}

			try {
				const db = listLocalDatabases().pop();
				return `file:${db}`;
			}
			catch (e) {
				if (e instanceof Error) {
					console.error('Failed to get Miniflare DB, try bun db:create:cf');
				}
				return '';
			}
		})(),
	},
});
