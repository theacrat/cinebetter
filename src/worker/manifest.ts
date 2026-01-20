import { UserSettings } from "../shared/user-settings";
import {
	ContentTypes,
	ExtraTypes,
	Manifest,
	ManifestCatalog,
	ResourceTypes,
} from "stremio-types";

export const CinebetterCatalogs = {
	SEARCH: "search",
	POPULAR: "top",
	NEW: "year",
	FEATURED: "imdbRating",
	CALENDAR: "calendar",
	NOTIFICATIONS: "notifications",
} as const;

export type CinebetterCatalogs =
	(typeof CinebetterCatalogs)[keyof typeof CinebetterCatalogs];

export function isCatalog(value: string): value is CinebetterCatalogs {
	return Object.values(CinebetterCatalogs).includes(
		value as CinebetterCatalogs,
	);
}

const DETAILED_CATALOGS = new Set<CinebetterCatalogs>([
	CinebetterCatalogs.CALENDAR,
	CinebetterCatalogs.NOTIFICATIONS,
]);

export function isDetailedCatalog(catalog: CinebetterCatalogs): boolean {
	return DETAILED_CATALOGS.has(catalog);
}

type CinebetterManifest = Omit<Manifest, "catalogs"> & {
	catalogs: (ManifestCatalog & {
		id: CinebetterCatalogs;
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

export function getManifestJson(settings: UserSettings): CinebetterManifest {
	return {
		id: "dev.thea.cinebetter",
		version: "1.0.0",
		name: "Cinebetter",
		description: "IMDb metadata in Stremio",
		catalogs: [
			...[ContentTypes.MOVIE, ContentTypes.SERIES].map<
				CinebetterManifest["catalogs"]
			>((t) => [
				{
					type: t,
					id: CinebetterCatalogs.SEARCH,
					name: "Search",
					extra: [
						{
							name: ExtraTypes.SEARCH,
							isRequired: true,
						},
					],
				},
				{
					type: t,
					id: CinebetterCatalogs.POPULAR,
					name: "Popular",
					extra: [
						{
							name: ExtraTypes.GENRE,
							options: settings.discoverOnly
								? IMDB_GENRES_WITH_ALL
								: IMDB_GENRES,
							isRequired: settings.discoverOnly,
						},
						{
							name: "skip",
						},
					],
				},
				{
					type: t,
					id: CinebetterCatalogs.NEW,
					name: "New",
					extra: [
						{
							name: ExtraTypes.GENRE,
							options: Array.from(
								{ length: new Date().getUTCFullYear() - 1874 + 1 },
								(_, i) => String(1874 + i),
							).reverse(),
							isRequired: true,
						},
						{
							name: ExtraTypes.SKIP,
						},
					],
				},
				{
					type: t,
					id: CinebetterCatalogs.FEATURED,
					name: "Featured",
					extra: [
						{
							name: ExtraTypes.GENRE,
							options: settings.discoverOnly
								? IMDB_GENRES_WITH_ALL
								: IMDB_GENRES,
							isRequired: settings.discoverOnly,
						},
						{
							name: ExtraTypes.SKIP,
						},
					],
				},
			]),
			...([
				{
					type: ContentTypes.SERIES,
					id: CinebetterCatalogs.CALENDAR,
					name: "Calendar",
					extra: [
						{
							name: ExtraTypes.CALENDARVIDEOSIDS,
							isRequired: true,
							optionsLimit: 100,
						},
					],
				},
				{
					type: ContentTypes.SERIES,
					id: CinebetterCatalogs.NOTIFICATIONS,
					name: "Notifications",
					extra: [
						{
							name: ExtraTypes.LASTVIDEOSIDS,
							isRequired: true,
							optionsLimit: 100,
						},
					],
				},
			] as CinebetterManifest["catalogs"]),
		].flat(),
		resources: [ResourceTypes.CATALOG, ResourceTypes.META],
		types: [ContentTypes.MOVIE, ContentTypes.SERIES],
		idPrefixes: ["tt"],
		behaviorHints: {
			configurable: true,
			configurationRequired: false,
		},
	};
}
