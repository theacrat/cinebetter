import { UserSettings, encodeSettings } from "../../shared/user-settings";
import type { Context } from "hono";

export function getTransportUrl(c: Context, settings: UserSettings) {
	const url = new URL(c.req.url);
	url.pathname = `/${encodeSettings(settings)}/manifest.json`;
	return url.href;
}
