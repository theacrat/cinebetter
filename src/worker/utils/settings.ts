import {
	DEFAULT_SETTINGS,
	decodeSettings,
	UserSettings,
} from "../../shared/user-settings";
import { AppEnv } from "../app";
import { Context } from "hono";

export function processSettings(
	c: Context<AppEnv>,
): asserts c is Context<AppEnv> &
	Context<{ Variables: { settings: UserSettings } }> {
	const settings = c.req.param("settings");
	const decodedSettings = settings
		? decodeSettings(settings)
		: DEFAULT_SETTINGS;
	c.set("settings", decodedSettings);
}
