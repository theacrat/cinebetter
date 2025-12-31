import { graphql } from "../../../generated/gql";

export const GetMoreEpisodesQuery = graphql(`
	query GetMoreEpisodes($id: ID!, $after: ID!) {
		title(id: $id) {
			episodes {
				episodes(
					sort: { by: EPISODE_THEN_RELEASE, order: ASC }
					first: 250
					after: $after
				) {
					...EpisodesConnection
				}
			}
		}
	}
`);
