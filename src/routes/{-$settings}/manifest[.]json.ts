import { createFileRoute } from '@tanstack/react-router';
import { buildReqContext } from '@/lib/req-context';
import { getManifestJson } from '@/services/manifest';

export const Route = createFileRoute('/{-$settings}/manifest.json')({
	server: {
		handlers: {
			GET: ({ params, request }) => {
				const c = buildReqContext(request, params.settings);

				return Response.json(getManifestJson(c.settings));
			},
		},
	},
});
