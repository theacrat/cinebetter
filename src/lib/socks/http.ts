import concatBytes from "@/lib/socks/bytes";

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
const asciiDecoder = new TextDecoder("ascii");
const CRLF_BYTES = encoder.encode(CRLF);
const HEADER_END_BYTES = encoder.encode(HEADER_END);

interface HttpRequest {
	readonly body: string;
	readonly headers: readonly (readonly [string, string])[];
	readonly host: string;
	readonly hostname: string;
	readonly method: string;
	readonly path: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- typed arrays have no readonly variant
const indexOfBytes = (haystack: Uint8Array, needle: Uint8Array, from: number): number => {
	for (let index = from; index <= haystack.length - needle.length; index += NEXT) {
		if (needle.every((byte, offset) => haystack[index + offset] === byte)) {
			return index;
		}
	}
	return NOT_FOUND;
};

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- typed arrays have no readonly variant
const startsWithAt = (haystack: Uint8Array, needle: Uint8Array, at: number): boolean =>
	needle.every((byte, offset) => haystack[at + offset] === byte);

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- typed arrays have no readonly variant
const dechunk = (data: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> => {
	const chunks: Uint8Array<ArrayBuffer>[] = [];
	let offset = START;

	for (;;) {
		const lineEnd = indexOfBytes(data, CRLF_BYTES, offset);
		const size = Number.parseInt(asciiDecoder.decode(data.subarray(offset, lineEnd)), HEX_RADIX);
		if (lineEnd === NOT_FOUND || Number.isNaN(size)) {
			throw new Error("Malformed chunked response from IMDb");
		}
		if (size === LAST_CHUNK_SIZE) {
			return concatBytes(chunks);
		}

		const chunkStart = lineEnd + CRLF_BYTES.length;
		const chunkEnd = chunkStart + size;
		if (!startsWithAt(data, CRLF_BYTES, chunkEnd)) {
			throw new Error("Truncated chunked response from IMDb");
		}
		chunks.push(data.subarray(chunkStart, chunkEnd));
		offset = chunkEnd + CRLF_BYTES.length;
	}
};

const readBody = (
	// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- typed arrays have no readonly variant
	rest: Uint8Array<ArrayBuffer>,
	headers: Readonly<Headers>,
): Uint8Array<ArrayBuffer> => {
	if (headers.get("transfer-encoding")?.toLowerCase().includes("chunked") === true) {
		return dechunk(rest);
	}

	const contentLengthHeader = headers.get("content-length");
	if (contentLengthHeader === null) {
		return rest;
	}

	const contentLength = Number(contentLengthHeader);
	if (!Number.isSafeInteger(contentLength) || contentLength < START) {
		throw new Error("Invalid Content-Length from IMDb");
	}
	if (rest.length < contentLength) {
		throw new Error("Truncated response from IMDb");
	}
	return rest.subarray(START, contentLength);
};

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- typed arrays have no readonly variant
const parseResponse = (raw: Uint8Array<ArrayBuffer>): Response => {
	const headerEnd = indexOfBytes(raw, HEADER_END_BYTES, START);
	if (headerEnd === NOT_FOUND) {
		throw new Error("IMDb closed the connection before sending headers");
	}

	const [statusLine = "", ...headerLines] = asciiDecoder
		.decode(raw.subarray(START, headerEnd))
		.split(CRLF);
	const status = Number(statusLine.split(" ")[HTTP_STATUS_PART]);
	const headers = new Headers(
		headerLines.map((line): [string, string] => {
			const separator = line.indexOf(":");
			return [line.slice(START, separator).trim(), line.slice(separator + NEXT).trim()];
		}),
	);

	const body = readBody(raw.subarray(headerEnd + HEADER_END_BYTES.length), headers);
	headers.delete("transfer-encoding");
	headers.delete("content-length");

	return NO_BODY_STATUSES.has(status)
		? new Response(undefined, { headers, status })
		: new Response(body, { headers, status });
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
