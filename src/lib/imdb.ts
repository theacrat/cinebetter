import type { CombinedError, TypedDocumentNode } from "@urql/core";
import { cacheExchange, Client, fetchExchange } from "@urql/core";
import stripUndefined from "strip-undefined";
import type { ReadonlyDeep } from "type-fest";

import env from "@/env";
import createSocksFetch from "@/lib/socks";
import type { UserSettings } from "@/lib/user-settings";

const PROXY_TOKEN_HEADER = "x-proxy-token";
const USER_AGENT_HEADER =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.3";

interface ImdbClient {
	readonly query: <Data, Variables extends Record<string, unknown>>(
		query: ReadonlyDeep<TypedDocumentNode<Data, Variables>>,
		variables: Variables,
	) => Promise<Data | undefined>;
}

const ERROR_DETAIL_START = 0;
const ERROR_DETAIL_MAX_LENGTH = 300;

const summariseErrorDetail = (detail: string): string =>
	detail.replaceAll(/\s+/gu, " ").slice(ERROR_DETAIL_START, ERROR_DETAIL_MAX_LENGTH);

const SOCKS_PROTOCOL = "socks5:";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Response is a mutable platform type
const throwIfNotOk = async (response: Response): Promise<Response> => {
	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(`HTTP ${response.status}: ${body}`);
	}

	return response;
};

const createHttpProxyFetch =
	(proxyUrl: string): typeof fetch =>
	// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- matches fetch's signature, whose Request/RequestInit types can't be deeply readonly
	async (_input, init) => {
		const headers = new Headers(init?.headers);
		if (env.IMDB_PROXY_TOKEN !== undefined) {
			headers.set(PROXY_TOKEN_HEADER, env.IMDB_PROXY_TOKEN);
		}

		return fetch(proxyUrl, { ...init, headers });
	};

const getProxyFetch = (proxyUrl: string): typeof fetch =>
	new URL(proxyUrl).protocol === SOCKS_PROTOCOL
		? createSocksFetch(proxyUrl)
		: createHttpProxyFetch(proxyUrl);

const createImdbFetch = (): typeof fetch => {
	const proxyUrl = env.IMDB_PROXY_URL;
	const proxyFetch = proxyUrl === undefined ? fetch : getProxyFetch(proxyUrl);

	// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- matches fetch's signature, whose Request/RequestInit types can't be deeply readonly
	return async (...args) => throwIfNotOk(await proxyFetch(...args));
};

const handleCombinedError = (error: ReadonlyDeep<CombinedError>): never => {
	if (error.networkError) {
		throw new Error(
			`Network error while connecting to the IMDb API: ${summariseErrorDetail(error.networkError.message)}`,
			{
				cause: error,
			},
		);
	}

	throw new Error("GraphQL query error", {
		cause: error,
	});
};

const createClient = (settings: UserSettings): ImdbClient => {
	const [, country] = settings.languageCode.split("-");
	const client = new Client({
		exchanges: [cacheExchange, fetchExchange],
		fetch: createImdbFetch(),
		fetchOptions: (): { headers: Record<string, string> } => ({
			headers: stripUndefined<Record<string, string>>({
				"Content-Type": "application/json",
				"User-Agent": USER_AGENT_HEADER,
				"x-imdb-client-name": "imdb-web-next",
				"x-imdb-user-country": country,
				"x-imdb-user-language": settings.languageCode,
			}),
		}),
		preferGetMethod: false,
		url: "https://api.graphql.imdb.com/",
	});

	return {
		query: async <Data, Variables extends Record<string, unknown>>(
			query: ReadonlyDeep<TypedDocumentNode<Data, Variables>>,
			variables: Variables,
		): Promise<Data | undefined> => {
			const { data, error } = await client.query(query, variables);

			if (error) {
				handleCombinedError(error);
			}

			return data;
		},
	};
};

export { createClient, type ImdbClient };
