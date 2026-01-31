import { graphql } from '../../../generated/gql';

export const Titles = graphql(`
	query Titles($ids: [ID!]!, $episodeCount: Int) {
		titles(ids: $ids) {
			id
			titleText {
				text
			}
			titleType {
				canHaveEpisodes
			}
			plot {
				plotText {
					plainText
				}
			}
			primaryImage {
				url
			}
			episodes {
				episodes(last: $episodeCount, filter: { excludeSeasons: ["unknown"] }) {
					...EpisodesConnection
				}
			}
		}
	}
`);
