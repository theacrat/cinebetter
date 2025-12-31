declare global {
	namespace NodeJS {
		interface ProcessEnv extends CommonEnv {
			[key: string]: string | undefined;
		}
	}
}

export interface CommonEnv {
	NODE_ENV: string;
	SQLITE_DB: string;
	SQLITE_AUTH: string;
	TMDB_TOKEN: string;
	PORT: string;
}

export {};
