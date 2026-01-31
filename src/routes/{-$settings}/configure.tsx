import { createFileRoute } from '@tanstack/react-router';
import { ConfigurePage } from '@/components/ConfigurePage';
import { decodeSettings, DEFAULT_SETTINGS } from '@/lib/user-settings';

export const Route = createFileRoute('/{-$settings}/configure')({ component: ConfigureComponent });

function ConfigureComponent() {
	const { settings } = Route.useParams();

	try {
		const userSettings = settings != null ? decodeSettings(settings) : DEFAULT_SETTINGS;
		return <ConfigurePage initialSettings={userSettings} />;
	}
	catch {
		return <ConfigurePage initialSettings={DEFAULT_SETTINGS} />;
	}
}
