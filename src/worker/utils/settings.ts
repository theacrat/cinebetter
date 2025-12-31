import { DEFAULT_SETTINGS, decodeSettings } from "../../shared/user-settings";
import { AppContext } from "../app";

export function processSettings(c: AppContext) {
	const settings = c.req.param("settings");
	const decodedSettings = settings
		? decodeSettings(settings)
		: DEFAULT_SETTINGS;
	c.set("settings", decodedSettings);
	return decodedSettings;
}
