import { graphql } from '../../../generated/gql';

export const EpisodesConnectionFragment = graphql(`
	fragment EpisodesConnection on EpisodeConnection {
		edges {
			node {
				id
				series {
					displayableEpisodeNumber {
						displayableSeason {
							text
						}
						episodeNumber {
							text
						}
					}
				}
				titleText {
					text
				}
				plot {
					plotText {
						plainText
					}
				}
				releaseYear {
					year
				}
				releaseDate {
					year
					month
					day
				}
				primaryImage {
					url
				}
			}
		}
		pageInfo {
			hasNextPage
			endCursor
		}
	}
`);
