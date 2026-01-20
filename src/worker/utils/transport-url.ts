import { encodeSettings } from "../../shared/user-settings";
import { AppContext } from "../app";

export function getTransportUrl(c: AppContext) {
	const url = new URL(c.req.url);
	url.pathname = `/${encodeSettings(c.var.settings)}/manifest.json`;
	return url.href;
}
