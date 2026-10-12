declare global {
	namespace NodeJS {
		interface ProcessEnv extends AppEnv, DevEnv {}
	}
}

interface AppEnv {
	// All environments
	USE_CACHE?: string;
	TMDB_TOKEN?: string;
	IMDB_PROXY_URL?: string;
	IMDB_PROXY_TOKEN?: string;

	// Bun only
	SQLITE_DB?: string;
	SQLITE_AUTH?: string;
	VALKEY_HOST?: string;
	VALKEY_PORT?: string;
	VALKEY_USERNAME?: string;
	VALKEY_PASSWORD?: string;
	VALKEY_TLS?: string;

	CACHE_DAYS_META?: string;
	CACHE_DAYS_CATALOG?: string;
}

interface DevEnv {
	CF?: string;
}

export type { AppEnv };
