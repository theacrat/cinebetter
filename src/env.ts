import type { ZodType } from 'zod';
import type { AppEnv } from '../env';
import process from 'node:process';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
	server: {
		// All environments
		USE_CACHE: z.stringbool().default(true),
		TMDB_TOKEN: z.string(),

		// Bun only
		SQLITE_DB: z.string().optional(),
		SQLITE_AUTH: z.string().optional(),

		VALKEY_HOST: z.string().optional(),
		VALKEY_PORT: z.coerce.number().default(6379),
		VALKEY_USERNAME: z.string().optional(),
		VALKEY_PASSWORD: z.string().optional(),
		VALKEY_TLS: z.stringbool().default(false),

		CACHE_DAYS_CATALOG: z.coerce.number().default(1),
		CACHE_DAYS_META: z.coerce.number().default(7),
	} satisfies Record<keyof AppEnv, ZodType>,
	runtimeEnv: process.env,
});
