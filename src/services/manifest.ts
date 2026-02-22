import type { ContentType, Manifest, ManifestCatalog } from "stremio-types";
import { ContentTypes, ExtraTypes, ResourceTypes } from "stremio-types";
import { objectValues } from "ts-extras";

import type { UserSettings } from "@/lib/user-settings";

const CinebetterCatalogs = {
	CALENDAR: "calendar",
	FEATURED: "imdbRating",
	NEW: "year",
	NOTIFICATIONS: "notifications",
	POPULAR: "top",
	SEARCH: "search",
} as const;

type CinebetterCatalog = (typeof CinebetterCatalogs)[keyof typeof CinebetterCatalogs];

const isCatalog = (value: unknown): value is CinebetterCatalog =>
	typeof value === "string" && (objectValues(CinebetterCatalogs) as string[]).includes(value);

type SupportedType = Extract<ContentType, "movie" | "series">;

const isSupportedType = (value: unknown): value is SupportedType =>
	value === "movie" || value === "series";

const DETAILED_CATALOGS = new Set<CinebetterCatalog>([
	CinebetterCatalogs.CALENDAR,
	CinebetterCatalogs.NOTIFICATIONS,
]);

const isDetailedCatalog = (catalog: CinebetterCatalog): boolean => DETAILED_CATALOGS.has(catalog);

type CinebetterManifest = Omit<Manifest, "catalogs"> & {
	catalogs: (ManifestCatalog & {
		id: CinebetterCatalog;
	})[];
};

const IMDB_GENRES = [
	"Action",
	"Adventure",
	"Animation",
	"Biography",
	"Comedy",
	"Crime",
	"Documentary",
	"Drama",
	"Family",
	"Fantasy",
	"Film-Noir",
	"Game-Show",
	"History",
	"Horror",
	"Music",
	"Musical",
	"Mystery",
	"News",
	"Reality-TV",
	"Romance",
	"Sci-Fi",
	"Short",
	"Sport",
	"Talk-Show",
	"Thriller",
	"War",
	"Western",
];

const IMDB_GENRES_WITH_ALL = ["All", ...IMDB_GENRES];
const IMDB_EARLIEST_YEAR = 1874;
const CURRENT_YEAR_OFFSET = 1;
const CALENDAR_OPTIONS_LIMIT = 100;

const buildDiscoverOptions = (settings: UserSettings): string[] =>
	settings.discoverOnly ? IMDB_GENRES_WITH_ALL : IMDB_GENRES;

const buildYearOptions = (): string[] =>
	Array.from(
		{
			length: new Date().getUTCFullYear() - IMDB_EARLIEST_YEAR + CURRENT_YEAR_OFFSET,
		},
		(_year, yearIndex) => String(IMDB_EARLIEST_YEAR + yearIndex),
	).toReversed();

const buildSearchCatalog = (type: SupportedType): CinebetterManifest["catalogs"][number] => ({
	extra: [
		{
			isRequired: true,
			name: ExtraTypes.SEARCH,
		},
	],
	id: CinebetterCatalogs.SEARCH,
	name: "Search",
	type,
});

const buildPopularCatalog = (
	settings: UserSettings,
	type: SupportedType,
): CinebetterManifest["catalogs"][number] => ({
	extra: [
		{
			isRequired: settings.discoverOnly,
			name: ExtraTypes.GENRE,
			options: buildDiscoverOptions(settings),
		},
		{
			name: "skip",
		},
	],
	id: CinebetterCatalogs.POPULAR,
	name: "Popular",
	type,
});

const buildNewCatalog = (type: SupportedType): CinebetterManifest["catalogs"][number] => ({
	extra: [
		{
			isRequired: true,
			name: ExtraTypes.GENRE,
			options: buildYearOptions(),
		},
		{
			name: ExtraTypes.SKIP,
		},
	],
	id: CinebetterCatalogs.NEW,
	name: "New",
	type,
});

const buildFeaturedCatalog = (
	settings: UserSettings,
	type: SupportedType,
): CinebetterManifest["catalogs"][number] => ({
	extra: [
		{
			isRequired: settings.discoverOnly,
			name: ExtraTypes.GENRE,
			options: buildDiscoverOptions(settings),
		},
		{
			name: ExtraTypes.SKIP,
		},
	],
	id: CinebetterCatalogs.FEATURED,
	name: "Featured",
	type,
});

const buildCatalogsForType = (
	settings: UserSettings,
	type: SupportedType,
): CinebetterManifest["catalogs"] => [
	buildSearchCatalog(type),
	buildPopularCatalog(settings, type),
	buildNewCatalog(type),
	buildFeaturedCatalog(settings, type),
];

const buildSeriesOnlyCatalogs = (): CinebetterManifest["catalogs"] => [
	{
		extra: [
			{
				isRequired: true,
				name: ExtraTypes.CALENDARVIDEOSIDS,
				optionsLimit: CALENDAR_OPTIONS_LIMIT,
			},
		],
		id: CinebetterCatalogs.CALENDAR,
		name: "Calendar",
		type: ContentTypes.SERIES,
	},
	{
		extra: [
			{
				isRequired: true,
				name: ExtraTypes.LASTVIDEOSIDS,
				optionsLimit: CALENDAR_OPTIONS_LIMIT,
			},
		],
		id: CinebetterCatalogs.NOTIFICATIONS,
		name: "Notifications",
		type: ContentTypes.SERIES,
	},
];

const getManifestJson = (settings: UserSettings): CinebetterManifest => ({
	behaviorHints: {
		configurable: true,
		configurationRequired: false,
	},
	catalogs: [
		...buildCatalogsForType(settings, ContentTypes.MOVIE),
		...buildCatalogsForType(settings, ContentTypes.SERIES),
		...buildSeriesOnlyCatalogs(),
	],
	description: "IMDb metadata in Stremio",
	id: "dev.thea.cinebetter",
	idPrefixes: ["tt"],
	name: "Cinebetter",
	resources: [ResourceTypes.CATALOG, ResourceTypes.META],
	types: [ContentTypes.MOVIE, ContentTypes.SERIES],
	version: "1.0.0",
});

export {
	CinebetterCatalogs,
	type CinebetterCatalog,
	isCatalog,
	type SupportedType,
	isSupportedType,
	isDetailedCatalog,
	getManifestJson,
};
