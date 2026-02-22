import { createFileRoute } from "@tanstack/react-router";
import type { ReadonlyDeep } from "type-fest";

import { buildReqContext } from "@/lib/req-context";
import { getManifestJson } from "@/services/manifest";

interface ManifestGetProps {
	readonly params: {
		readonly settings: string;
	};
	readonly request: ReadonlyDeep<Request>;
}

const manifestGet = ({ params, request }: ManifestGetProps): Response => {
	const context = buildReqContext(request, params.settings);

	return Response.json(getManifestJson(context.settings));
};

export const Route = createFileRoute("/{-$settings}/manifest.json")({
	server: {
		handlers: {
			GET: manifestGet,
		},
	},
});
