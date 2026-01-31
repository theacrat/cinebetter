import type { UserSettings } from '@/lib/user-settings';
import { decodeSettings, DEFAULT_SETTINGS } from '@/lib/user-settings';

export interface ReqContext {
	req: Request;
	settings: UserSettings;
	settingsParam?: string;
}

export function buildReqContext(req: Request, settings?: string): ReqContext {
	const userSettings = settings != null ? decodeSettings(settings) : DEFAULT_SETTINGS;
	return {
		req,
		settings: userSettings,
		...(settings != null && { settingsParam: settings }),
	};
}
