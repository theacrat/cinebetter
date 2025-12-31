import { StremioType } from "./StremioMeta";

export const ExtraType = {
	SEARCH: "search",
	DISCOVER: "genre",
	SKIP: "skip",
	NOTIFICATION: "lastVideosIds",
	CALENDAR: "calendarVideosIds",
} as const;

export type ExtraType = (typeof ExtraType)[keyof typeof ExtraType];

export const AddonType = {
	CATALOG: "catalog",
	META: "meta",
	STREAM: "stream",
	SUBTITLES: "subtitles",
} as const;

export type AddonType = (typeof AddonType)[keyof typeof AddonType];

export interface Extra {
	name: ExtraType;
	isRequired?: boolean;
	options?: string[];
	optionsLimit?: number | null;
}

export interface Catalog {
	id: string;
	type: string;
	name?: string;
	extra?: Extra[];
	extraRequired?: string[];
	extraSupported?: string[];
}

export interface Resource {
	name: string;
	types?: string[];
	idPrefixes?: string[];
}

export interface BehaviorHints {
	adult?: boolean | null;
	p2p?: boolean | null;
	configurable?: boolean | null;
	configurationRequired?: boolean | null;
}

export interface Manifest {
	id: string;
	version: string;
	name: string;
	description: string;
	types: StremioType[];
	catalogs: Catalog[];
	resources: (Resource | AddonType)[];
	behaviorHints?: BehaviorHints;
	addonCatalogs?: Catalog[];
	contactEmail?: string | null;
	logo?: string | null;
	background?: string | null;
	idPrefixes?: string[];
}
