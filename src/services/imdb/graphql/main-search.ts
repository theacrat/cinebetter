import { graphql } from "@/generated/gql";

const MainSearch = graphql(`
	query Query($search: MainSearchOptions!) {
		mainSearch(first: 20, options: $search) {
			edges {
				node {
					entity {
						... on Title {
							id
							titleText {
								text
							}
							titleType {
								canHaveEpisodes
							}
							primaryImage {
								url
							}
							connections(first: 1, filter: { categories: ["follows"] }) {
								edges {
									node {
										associatedTitle {
											id
											connections(
												first: 1
												filter: { categories: ["follows"] }
											) {
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
	}
`);

export default MainSearch;
