import type { ReadonlyDeep } from "type-fest";

import type { UserSettings } from "@/lib/user-settings";
import { decodeSettings, DEFAULT_SETTINGS } from "@/lib/user-settings";
import stripUndefined from "@/utils/strip-undefined";

interface ReqContext {
	readonly req: ReadonlyDeep<Request>;
	readonly settings: UserSettings;
	readonly settingsParam?: string;
}

const buildReqContext = (req: ReadonlyDeep<Request>, settings?: string): ReqContext => {
	const userSettings = settings === undefined ? DEFAULT_SETTINGS : decodeSettings(settings);
	return stripUndefined<ReqContext>({
		req,
		settings: userSettings,
		settingsParam: settings,
	});
};

export { buildReqContext, type ReqContext };
