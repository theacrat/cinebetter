import { CommonEnv } from "../env";
import { DEFAULT_SETTINGS, UserSettings } from "../shared/user-settings";
import { ExtraType } from "./classes/StremioAddon";
import { isStremioType } from "./classes/StremioMeta";
import { getCatalog } from "./imdb/catalog";
import { getFullTitle } from "./imdb/title";
import { isCatalog, isDetailedCatalog, getManifestJson } from "./manifest";
import { withCache } from "./utils/cache";
import { processSettings } from "./utils/settings";
import { getTransportUrl } from "./utils/transport-url";
import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { enableArrayMethods } from "immer";

enableArrayMethods();

export type AppBindings = Partial<Env & CommonEnv>;

type HonoEnv = {
	Bindings: AppBindings;
	Variables: {
		settings: UserSettings;
	};
};

export type AppContext = Context<HonoEnv>;

const app = new Hono<HonoEnv>();

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
	const settings = processSettings(c);

	return c.json(getManifestJson(settings));
});

app.on(
	"GET",
	[
		"/meta/:type{(movie|series)}/:id",
		"/:settings/meta/:type{(movie|series)}/:id",
	],
	(c) => {
		const settings = processSettings(c);

		return withCache(
			c,
			{
				...DEFAULT_SETTINGS,
				languageCode: settings.languageCode,
			},
			async () => {
				const { id } = c.req.param();

				const result = await getFullTitle(
					c,
					getTransportUrl(c, settings),
					id.replace(/\.json$/, ""),
				);

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
		const settings = processSettings(c);

		const { query } = c.req.param();
		const queryParam = new URLSearchParams(
			(query || "").replace(/\.json$/, ""),
		);

		const cacheSettings: UserSettings = {
			...DEFAULT_SETTINGS,
			languageCode: settings.languageCode,
		};
		if (queryParam.get(ExtraType.SEARCH)) {
			cacheSettings.hideLowQuality = settings.hideLowQuality;
		}

		return withCache(c, cacheSettings, async () => {
			const { type, catalog } = c.req.param();

			if (!isCatalog(catalog) || !isStremioType(type)) {
				return {
					response: await c.notFound(),
					shouldCache: false,
					ttlDays: 0,
				};
			}

			const result = await getCatalog(
				c,
				getTransportUrl(c, settings),
				catalog,
				queryParam,
				type,
			);

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
