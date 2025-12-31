import { graphql } from "../../../generated/gql";
import type { QueryQuery } from "../../../generated/gql/graphql";

export const Query = graphql(`
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

export type MainSearchEdge = NonNullable<
	NonNullable<QueryQuery["mainSearch"]>["edges"][number]
>;

export type TitleEntity = Extract<
	MainSearchEdge["node"]["entity"],
	{ __typename?: "Title" }
>;

export function isTitleEdge(
	edge: MainSearchEdge | null | undefined,
): edge is NonNullable<MainSearchEdge> & {
	node: { entity: TitleEntity };
} {
	return edge?.node.entity.__typename === "Title";
}
