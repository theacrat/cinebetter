import { graphql } from "../../../generated/gql";

export const AdvancedTitleSearch = graphql(`
	query AdvancedTitleSearch(
		$search: AdvancedTitleSearchConstraints!
		$sort: AdvancedTitleSearchSort!
		$first: Int!
		$jumpToPosition: Int
	) {
		advancedTitleSearch(
			constraints: $search
			sort: $sort
			first: $first
			jumpToPosition: $jumpToPosition
		) {
			edges {
				node {
					title {
						id
						titleText {
							text
						}
						titleType {
							canHaveEpisodes
						}
						releaseYear {
							year
							endYear
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
			}
		}
	}
`);
