import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import ConfigurePage from "@/components/configure-page";
import env from "@/env";
import { decodeSettings, DEFAULT_SETTINGS } from "@/lib/user-settings";

const hasTmdbToken = createServerFn({ method: "GET" }).handler(
	() => env.TMDB_TOKEN !== undefined && env.TMDB_TOKEN !== "",
);

export const Route = createFileRoute("/{-$settings}/configure")({
	component: ConfigureComponent,
	loader: async () => ({
		enableTmdb: await hasTmdbToken(),
	}),
});

function ConfigureComponent() {
	const { settings } = Route.useParams();
	const { enableTmdb } = Route.useLoaderData();

	try {
		const userSettings = settings === undefined ? DEFAULT_SETTINGS : decodeSettings(settings);
		return <ConfigurePage initialSettings={userSettings} enableTmdb={enableTmdb} />;
	} catch {
		return <ConfigurePage initialSettings={DEFAULT_SETTINGS} enableTmdb={enableTmdb} />;
	}
}
