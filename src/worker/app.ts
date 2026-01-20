import { CommonEnv } from "../env";
import { DEFAULT_SETTINGS, UserSettings } from "../shared/user-settings";
import { getCatalog } from "./imdb/catalog";
import { getFullTitle } from "./imdb/title";
import { isCatalog, isDetailedCatalog, getManifestJson } from "./manifest";
import { withCache } from "./utils/cache";
import { processSettings } from "./utils/settings";
import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { enableArrayMethods } from "immer";
import { ExtraTypes, isContentType } from "stremio-types";

enableArrayMethods();

export type AppBindings = Partial<Env & CommonEnv>;

export type AppEnv = {
	Bindings: AppBindings;
	Variables: {
		settings?: UserSettings;
	};
};

export type AppContext = Context<
	AppEnv & { Variables: { settings: UserSettings } }
>;

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
	return cors({
		origin: "*",
	})(c, next);
});

app.onError((e, c) => {
	if (e instanceof HTTPException) {
		return c.text(e.message, e.status);
	}

	console.error("Internal error:", e.message);
	return c.text("A server error occured", 500);
});

app.on("GET", ["/manifest.json", "/:settings/manifest.json"], (c) => {
	processSettings(c);

	return c.json(getManifestJson(c.var.settings));
});

app.on(
	"GET",
	[
		"/meta/:type{(movie|series)}/:id",
		"/:settings/meta/:type{(movie|series)}/:id",
	],
	(c) => {
		processSettings(c);

		return withCache(
			c,
			{
				...DEFAULT_SETTINGS,
				languageCode: c.var.settings.languageCode,
			},
			async () => {
				const { id } = c.req.param();

				const result = await getFullTitle(c, id.replace(/\.json$/, ""));

				return {
					response: await (result ? c.json({ meta: result }) : c.notFound()),
					shouldCache: !!result,
					ttlDays: 3,
				};
			},
		);
	},
);

app.on(
	"GET",
	[
		"/catalog/:type{(movie|series)}/:catalog/:query?",
		"/:settings/catalog/:type{(movie|series)}/:catalog/:query?",
	],
	(c) => {
		processSettings(c);

		const { query } = c.req.param();
		const queryParam = new URLSearchParams(
			(query || "").replace(/\.json$/, ""),
		);

		const cacheSettings: UserSettings = {
			...DEFAULT_SETTINGS,
			languageCode: c.var.settings.languageCode,
		};
		if (queryParam.get(ExtraTypes.SEARCH)) {
			cacheSettings.hideLowQuality = c.var.settings.hideLowQuality;
		}

		return withCache(c, cacheSettings, async () => {
			const { type, catalog } = c.req.param();

			if (!isCatalog(catalog) || !isContentType(type)) {
				return {
					response: await c.notFound(),
					shouldCache: false,
					ttlDays: 0,
				};
			}

			const result = await getCatalog(c, catalog, queryParam, type);

			return {
				response: c.json(
					isDetailedCatalog(catalog)
						? { metasDetailed: result }
						: { metas: result },
				),
				shouldCache: !!result,
				ttlDays: 3,
			};
		});
	},
);

export default app;
