import { UserSettings } from "../../shared/user-settings";
import {
	CombinedError,
	Client,
	cacheExchange,
	fetchExchange,
	type AnyVariables,
	type TypedDocumentNode,
} from "@urql/core";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";

export class ImdbClient {
	constructor(private readonly client: Client) {}

	async query<Data, Variables extends AnyVariables>(
		query: TypedDocumentNode<Data, Variables>,
		variables: Variables,
	): Promise<Data | undefined> {
		const { data, error } = await this.client.query(query, variables);

		if (error) {
			ImdbClient.handleCombinedError(error);
		}

		return data;
	}

	private static handleCombinedError(error: CombinedError): never {
		console.error("GraphQL CombinedError:", error.message);

		if (error.networkError) {
			throw new HTTPException(StatusCodes.SERVICE_UNAVAILABLE, {
				message: "Network error while connecting to the IMDb API",
				cause: error,
			});
		} else {
			throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
				message: "GraphQL query error",
				cause: error,
			});
		}
	}
}

export function createClient(settings: UserSettings) {
	const client = new Client({
		url: "https://api.graphql.imdb.com/",
		exchanges: [cacheExchange, fetchExchange],
		preferGetMethod: false,
		fetchOptions: () => {
			return {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.3",
					"Content-Type": "application/json",
					"x-imdb-user-country": settings.languageCode.split("-")[1],
					"x-imdb-user-language": settings.languageCode,
				},
			};
		},
	});

	return new ImdbClient(client);
}
