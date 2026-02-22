// oxlint-disable typescript/explicit-module-boundary-types
// oxlint-disable typescript/explicit-function-return-type
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen.ts";

export function getRouter() {
	const router = createRouter({
		defaultPreload: "intent",
		routeTree,
	});

	return router;
}
