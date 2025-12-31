import { StremioSubtitle } from "./StremioSubtitle";

export interface BehaviorHints {
	countryWhitelist?: string | null;
	notWebReady?: boolean | null;
	proxyHeaders?: string | null;
	videoHash?: string | null;
	videoSize?: number | null;
	filename?: string | null;
}

export interface StremioStream {
	url?: string | null;
	ytId?: string | null;
	infoHash?: string | null;
	fileIdx?: number | null;
	fileMustInclude?: string | null;
	nzbUrl?: string | null;
	rarUrls?: string | null;
	zipUrls?: string | null;
	sevenZipUrls?: string | null;
	tgzUrls?: string | null;
	tarUrls?: string | null;
	externalUrl?: string | null;
	name?: string | null;
	description?: string | null;
	subtitles?: StremioSubtitle[];
	sources?: string[];
	behaviorHints?: BehaviorHints;
}
