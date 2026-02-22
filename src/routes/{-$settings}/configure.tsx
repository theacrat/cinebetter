import { createFileRoute } from "@tanstack/react-router";

import ConfigurePage from "@/components/configure/configure-page";
import { decodeSettings, DEFAULT_SETTINGS } from "@/lib/user-settings";

export const Route = createFileRoute("/{-$settings}/configure")({ component: ConfigureComponent });

function ConfigureComponent() {
	const { settings } = Route.useParams();

	try {
		const userSettings = settings === undefined ? DEFAULT_SETTINGS : decodeSettings(settings);
		return <ConfigurePage initialSettings={userSettings} />;
	} catch {
		return <ConfigurePage initialSettings={DEFAULT_SETTINGS} />;
	}
}
