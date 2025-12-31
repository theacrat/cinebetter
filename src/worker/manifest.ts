import { UserSettings } from "../shared/user-settings";
import type { Catalog, Manifest } from "./classes/StremioAddon";
import { AddonType, ExtraType } from "./classes/StremioAddon";
import { StremioType } from "./classes/StremioMeta";

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
	catalogs: (Omit<Catalog, "id"> & {
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
		id: "pet.thea.cinebetter",
		version: "1.0.0",
		name: "Cinebetter",
		description: "IMDb metadata in Stremio",
		logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/IMDB_Logo_2016.svg/575px-IMDB_Logo_2016.svg.png",
		background:
			"https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/IMDB_Logo_2016.svg/575px-IMDB_Logo_2016.svg.png",
		catalogs: [
			...[StremioType.MOVIE, StremioType.SERIES].flatMap((t) => [
				{
					type: t,
					id: CinebetterCatalogs.SEARCH,
					name: "Search",
					extra: [
						{
							name: ExtraType.SEARCH,
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
							name: ExtraType.DISCOVER,
							options: settings.discoverOnly
								? IMDB_GENRES_WITH_ALL
								: IMDB_GENRES,
							isRequired: settings.discoverOnly,
						},
						{
							name: ExtraType.SKIP,
						},
					],
				},
				{
					type: t,
					id: CinebetterCatalogs.NEW,
					name: "New",
					extra: [
						{
							name: ExtraType.DISCOVER,
							options: Array.from(
								{ length: new Date().getUTCFullYear() - 1874 + 1 },
								(_, i) => String(1874 + i),
							).reverse(),
							isRequired: true,
						},
						{
							name: ExtraType.SKIP,
						},
					],
				},
				{
					type: t,
					id: CinebetterCatalogs.FEATURED,
					name: "Featured",
					extra: [
						{
							name: ExtraType.DISCOVER,
							options: settings.discoverOnly
								? IMDB_GENRES_WITH_ALL
								: IMDB_GENRES,
							isRequired: settings.discoverOnly,
						},
						{
							name: ExtraType.SKIP,
						},
					],
				},
			]),
			...(settings.calendarAndNotifications
				? [
						{
							type: StremioType.SERIES,
							id: CinebetterCatalogs.CALENDAR,
							name: "Calendar",
							extra: [
								{
									name: ExtraType.CALENDAR,
									isRequired: true,
									optionsLimit: 100,
								},
							],
						},
						{
							type: StremioType.SERIES,
							id: CinebetterCatalogs.NOTIFICATIONS,
							name: "Notifications",
							extra: [
								{
									name: ExtraType.NOTIFICATION,
									isRequired: true,
									optionsLimit: 100,
								},
							],
						},
					]
				: []),
		],
		resources: [AddonType.CATALOG, AddonType.META],
		types: [StremioType.MOVIE, StremioType.SERIES],
		idPrefixes: ["tt"],
		behaviorHints: {
			configurable: true,
			configurationRequired: false,
		},
	};
}
