declare global {
	namespace NodeJS {
		interface ProcessEnv extends AppEnv {}
	}
}

export interface AppEnv {
	// All environments
	USE_CACHE?: string;
	TMDB_TOKEN?: string;

	// Dev only
	CF?: string;

	// Bun only
	SQLITE_DB?: string;
	SQLITE_AUTH?: string;
	VALKEY_HOST?: string;
	VALKEY_PORT?: string;
	VALKEY_USERNAME?: string;
	VALKEY_PASSWORD?: string;
	VALKEY_TLS?: string;
}

export {};
