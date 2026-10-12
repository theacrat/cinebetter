const CRLF = "\r\n";
const HEADER_END = "\r\n\r\n";
const HEX_RADIX = 16;
const NOT_FOUND = -1;
const START = 0;
const NEXT = 1;
const LAST_CHUNK_SIZE = 0;
const HTTP_STATUS_PART = 1;
const NO_CONTENT_STATUS = 204;
const NOT_MODIFIED_STATUS = 304;
const NO_BODY_STATUSES = new Set([NO_CONTENT_STATUS, NOT_MODIFIED_STATUS]);
const SKIPPED_REQUEST_HEADERS = new Set([
	"accept-encoding",
	"connection",
	"content-length",
	"host",
]);

const encoder = new TextEncoder();

interface HttpRequest {
	readonly body: string;
	readonly headers: readonly (readonly [string, string])[];
	readonly host: string;
	readonly hostname: string;
	readonly method: string;
	readonly path: string;
}

const fromLatin1 = (text: string): Uint8Array<ArrayBuffer> =>
	Uint8Array.from(text, (character) => character.codePointAt(START) ?? START);

const dechunk = (data: string): string => {
	const chunks: string[] = [];
	let offset = START;

	for (;;) {
		const lineEnd = data.indexOf(CRLF, offset);
		const size = Number.parseInt(data.slice(offset, lineEnd), HEX_RADIX);
		if (lineEnd === NOT_FOUND || Number.isNaN(size)) {
			throw new Error("Malformed chunked response from IMDb");
		}
		if (size === LAST_CHUNK_SIZE) {
			return chunks.join("");
		}

		const chunkStart = lineEnd + CRLF.length;
		const chunkEnd = chunkStart + size;
		if (data.slice(chunkEnd, chunkEnd + CRLF.length) !== CRLF) {
			throw new Error("Truncated chunked response from IMDb");
		}
		chunks.push(data.slice(chunkStart, chunkEnd));
		offset = chunkEnd + CRLF.length;
	}
};

const readBody = (rest: string, headers: Readonly<Headers>): string => {
	if (headers.get("transfer-encoding")?.toLowerCase().includes("chunked") === true) {
		return dechunk(rest);
	}

	const contentLength = headers.get("content-length");
	if (contentLength !== null && rest.length < Number(contentLength)) {
		throw new Error("Truncated response from IMDb");
	}
	return contentLength === null ? rest : rest.slice(START, Number(contentLength));
};

const parseResponse = (raw: string): Response => {
	const headerEnd = raw.indexOf(HEADER_END);
	if (headerEnd === NOT_FOUND) {
		throw new Error("IMDb closed the connection before sending headers");
	}

	const [statusLine = "", ...headerLines] = raw.slice(START, headerEnd).split(CRLF);
	const status = Number(statusLine.split(" ")[HTTP_STATUS_PART]);
	const headers = new Headers(
		headerLines.map((line): [string, string] => {
			const separator = line.indexOf(":");
			return [line.slice(START, separator).trim(), line.slice(separator + NEXT).trim()];
		}),
	);

	const body = readBody(raw.slice(headerEnd + HEADER_END.length), headers);
	headers.delete("transfer-encoding");
	headers.delete("content-length");

	return NO_BODY_STATUSES.has(status)
		? new Response(undefined, { headers, status })
		: new Response(fromLatin1(body), { headers, status });
};

const serialiseRequest = (request: HttpRequest): string =>
	[
		`${request.method} ${request.path} HTTP/1.1`,
		`Host: ${request.host}`,
		...request.headers
			.filter(([name]) => !SKIPPED_REQUEST_HEADERS.has(name))
			.map(([name, value]) => `${name}: ${value}`),
		"Accept-Encoding: identity",
		"Connection: close",
		`Content-Length: ${encoder.encode(request.body).length}`,
		"",
		request.body,
	].join(CRLF);

export { parseResponse, serialiseRequest, type HttpRequest };
