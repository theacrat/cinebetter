const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const CACHE_CONTROL_MAX_AGE_PATTERN = /max-age=(?<maxAge>\d+)/;
const DEFAULT_MAX_AGE = "0";
const MILLISECONDS_PER_SECOND = 1000;

const daysToCacheTime = (days: number): number =>
	days * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;

const getMaxAge = (headers: Readonly<Headers>): number => {
	const cacheControl = headers.get("Cache-Control");
	const maxAge = cacheControl?.match(CACHE_CONTROL_MAX_AGE_PATTERN)?.groups?.["maxAge"];

	return Number.parseInt(maxAge ?? DEFAULT_MAX_AGE, 10);
};

const setHeaders = (
	headers: Readonly<Headers>,
	ttl: number,
	cachedTime?: Readonly<Date>,
): Headers => {
	const ageHeader: [string, string][] =
		cachedTime === undefined
			? []
			: [
					[
						"Age",
						Math.floor((Date.now() - cachedTime.getTime()) / MILLISECONDS_PER_SECOND).toString(),
					],
				];

	return new Headers([
		...headers.entries(),
		["Access-Control-Allow-Origin", "*"],
		["Cache-Control", `public, max-age=${ttl}`],
		["Content-Type", "application/json"],
		...ageHeader,
	]);
};

export { daysToCacheTime, getMaxAge, setHeaders };
