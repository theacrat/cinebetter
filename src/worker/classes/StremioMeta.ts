import { StremioStream } from "./StremioStream";

export const PosterShape = {
	SQUARE: "square",
	LANDSCAPE: "landscape",
	POSTER: "poster",
} as const;

export type PosterShape = (typeof PosterShape)[keyof typeof PosterShape];

export const StremioType = {
	MOVIE: "movie",
	SERIES: "series",
	CHANNEL: "channel",
	TV: "tv",
	OTHER: "other",
} as const;

export type StremioType = (typeof StremioType)[keyof typeof StremioType];

export function isStremioType(value: string): value is StremioType {
	return Object.values(StremioType).includes(value as StremioType);
}

export interface Trailer {
	source: string;
	type: string;
}

export interface Link {
	name: string;
	category: string;
	url: string;
}

export interface BehaviorHints {
	defaultVideoId?: string;
}

export interface Video {
	id: string;
	title: string;
	released: Date;
	thumbnail?: string;
	streams?: StremioStream[];
	available?: boolean;
	episode?: number;
	season?: number;
	trailers?: StremioStream[];
	overview?: string;
}

export interface StremioMeta {
	id: string;
	type: string;
	name: string;
	posterShape: PosterShape;
	genres?: string[];
	poster?: string;
	background?: string;
	logo?: string;
	description?: string;
	releaseInfo?: string;
	director?: string[];
	cast?: string[];
	imdbRating?: string;
	released?: Date;
	trailers?: Trailer[];
	links?: Link[];
	videos?: Video[];
	runtime?: string;
	language?: string;
	country?: string;
	awards?: string;
	website?: string;
	behaviorHints?: BehaviorHints;
}
