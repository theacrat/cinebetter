import type {
	AnyVariables,
	CombinedError,
	TypedDocumentNode,
} from '@urql/core';
import type { UserSettings } from '@/lib/user-settings';
import { cacheExchange, Client, fetchExchange } from '@urql/core';

export class ImdbClient {
	private readonly client: Client;

	constructor(client: Client) {
		this.client = client;
	}

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
		console.error('GraphQL CombinedError:', error.message);

		if (error.networkError) {
			throw new Error('Network error while connecting to the IMDb API', {
				cause: error,
			});
		}
		else {
			throw new Error('GraphQL query error', {
				cause: error,
			});
		}
	}
}

export function createClient(settings: UserSettings) {
	const country = settings.languageCode.split('-')[1];
	const client = new Client({
		url: 'https://api.graphql.imdb.com/',
		exchanges: [cacheExchange, fetchExchange],
		preferGetMethod: false,
		fetchOptions: () => {
			return {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.3',
					'Content-Type': 'application/json',
					'x-imdb-user-language': settings.languageCode,
					...(country != null && { 'x-imdb-user-country': country }),
				},
			};
		},
	});

	return new ImdbClient(client);
}
