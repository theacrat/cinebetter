export function daysToCacheTime(days: number) {
	return days * 24 * 60 * 60;
}

export function getMaxAge(headers: Headers) {
	const cacheControl = headers.get('Cache-Control');
	const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1];

	return Number.parseInt(maxAge ?? '0');
}

export function setHeaders(headers: Headers, ttl: number, cachedTime?: Date) {
	headers.set('Access-Control-Allow-Origin', '*');
	headers.set('Cache-Control', `public, max-age=${ttl}`);
	headers.set('Content-Type', 'application/json');

	if (cachedTime) {
		const age = Math.floor((Date.now() - cachedTime.getTime()) / 1000);
		headers.set('Age', age.toString());
	}
}
