import process from "node:process";

import { createEnv } from "@t3-oss/env-core";
import type { ZodType } from "zod";
import { z } from "zod";

import type { AppEnv } from "./environment";

const DEFAULT_CACHE_DAYS_CATALOG = 1;
const DEFAULT_CACHE_DAYS_META = 7;
const DEFAULT_VALKEY_PORT = 6379;

export const env = createEnv({
	runtimeEnv: process.env,
	server: {
		CACHE_DAYS_CATALOG: z.coerce.number().default(DEFAULT_CACHE_DAYS_CATALOG),
		CACHE_DAYS_META: z.coerce.number().default(DEFAULT_CACHE_DAYS_META),
		SQLITE_AUTH: z.string().optional(),
		SQLITE_DB: z.string().optional(),
		TMDB_TOKEN: z.string().optional(),
		USE_CACHE: z.stringbool().default(true),
		VALKEY_HOST: z.string().optional(),
		VALKEY_PASSWORD: z.string().optional(),
		VALKEY_PORT: z.coerce.number().default(DEFAULT_VALKEY_PORT),
		VALKEY_TLS: z.stringbool().default(false),
		VALKEY_USERNAME: z.string().optional(),
	} satisfies Record<keyof AppEnv, ZodType>,
});

export default env;
