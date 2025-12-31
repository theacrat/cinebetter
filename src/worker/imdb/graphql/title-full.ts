import { graphql } from "../../../generated/gql";

export const TitleFull = graphql(`
	query Title($id: ID!) {
		title(id: $id) {
			id
			titleText {
				text
			}
			spokenLanguages {
				spokenLanguages {
					text
				}
			}
			releaseYear {
				year
				endYear
			}
			releaseDate {
				year
				month
				day
			}
			titleType {
				canHaveEpisodes
			}
			plot {
				plotText {
					plainText
				}
			}
			ratingsSummary {
				aggregateRating
			}
			primaryImage {
				url
			}
			runtime {
				displayableProperty {
					value {
						plainText
					}
				}
			}
			titleGenres {
				genres {
					genre {
						text
					}
				}
			}
			principalCredits {
				category {
					id
				}
				credits {
					name {
						id
						nameText {
							text
						}
					}
				}
			}
			episodes {
				episodes(first: 250, sort: { by: EPISODE_THEN_RELEASE, order: ASC }) {
					...EpisodesConnection
				}
			}
			countriesOfOrigin {
				countries {
					text
				}
			}
			awardNominations(first: 1000) {
				edges {
					node {
						isWinner
					}
				}
				total
			}
			externalLinks(first: 10, filter: { categories: ["official"] }) {
				edges {
					node {
						url
						label
					}
				}
			}
			connections(first: 1, filter: { categories: ["follows"] }) {
				edges {
					node {
						associatedTitle {
							id
							connections(first: 1, filter: { categories: ["follows"] }) {
								edges {
									node {
										associatedTitle {
											id
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
`);
