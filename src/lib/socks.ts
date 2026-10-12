const DEFAULT_SOCKS_PORT = 1080;
// 443 split into the two bytes SOCKS expects
const HTTPS_PORT_HIGH_BYTE = 1;
const HTTPS_PORT_LOW_BYTE = 187;
const TIMEOUT_MS = 15_000;

const SOCKS_VERSION = 0x05;
const AUTH_VERSION = 0x01;
const SUCCESS = 0x00;
const METHOD_PASSWORD = 0x02;
const ONE_METHOD = 0x01;
const COMMAND_CONNECT = 0x01;
const RESERVED = 0x00;
const ADDRESS_IPV4 = 0x01;
const ADDRESS_DOMAIN = 0x03;
const ADDRESS_IPV6 = 0x04;
const IPV4_LENGTH = 4;
const IPV6_LENGTH = 16;
const PORT_LENGTH = 2;
const MAX_FIELD_LENGTH = 255;
const REPLY_LENGTH = 2;
const CONNECT_HEADER_LENGTH = 4;
const STATUS_INDEX = 1;
const ADDRESS_TYPE_INDEX = 3;

const CRLF = "\r\n";
const HEADER_END = "\r\n\r\n";
const HEX_RADIX = 16;
const NOT_FOUND = -1;
const START = 0;
const NO_CONTENT_STATUS = 204;
const NOT_MODIFIED_STATUS = 304;
const NO_BODY_STATUSES = new Set([NO_CONTENT_STATUS, NOT_MODIFIED_STATUS]);
const NEXT = 1;
const SKIPPED_REQUEST_HEADERS = new Set([
	"accept-encoding",
	"connection",
	"content-length",
	"host",
]);

const encoder = new TextEncoder();

interface Connection {
	readonly readExactly: (length: number) => Promise<Uint8Array>;
	readonly readToEnd: () => Promise<string>;
	readonly write: (bytes: readonly number[] | string) => Promise<void>;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- typed arrays have no readonly variant
const toLatin1 = (bytes: Uint8Array): string =>
	Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");

const fromLatin1 = (text: string): Uint8Array<ArrayBuffer> =>
	Uint8Array.from(text, (character) => character.codePointAt(START) ?? START);

type Socket = ReturnType<(typeof import("cloudflare:sockets"))["connect"]>;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a Socket's streams are inherently mutable
const openConnection = (socket: Socket): Connection & { readonly release: () => void } => {
	// oxlint-disable-next-line typescript/no-unsafe-assignment -- workers-types declares socket streams as any, but they always carry bytes
	const reader: ReadableStreamDefaultReader<Uint8Array> = socket.readable.getReader();
	// oxlint-disable-next-line typescript/no-unsafe-assignment -- workers-types declares socket streams as any, but they always carry bytes
	const writer: WritableStreamDefaultWriter<Uint8Array> = socket.writable.getWriter();
	let pending: Uint8Array = new Uint8Array();

	const pull = async (): Promise<boolean> => {
		const { done, value } = await reader.read();
		if (done) {
			return false;
		}
		const merged = new Uint8Array(pending.length + value.length);
		merged.set(pending);
		merged.set(value, pending.length);
		pending = merged;
		return true;
	};

	const readExactly = async (length: number): Promise<Uint8Array> => {
		if (pending.length >= length) {
			const out = pending.slice(START, length);
			pending = pending.slice(length);
			return out;
		}
		if (!(await pull())) {
			throw new Error("SOCKS connection closed early");
		}
		return readExactly(length);
	};

	const readToEnd = async (): Promise<string> => ((await pull()) ? readToEnd() : toLatin1(pending));

	return {
		readExactly,
		readToEnd,
		release: (): void => {
			reader.releaseLock();
			writer.releaseLock();
		},
		write: async (bytes: readonly number[] | string): Promise<void> =>
			writer.write(typeof bytes === "string" ? encoder.encode(bytes) : Uint8Array.from(bytes)),
	};
};

const lengthPrefixed = (value: string): number[] => {
	const bytes = [...encoder.encode(value)];
	if (bytes.length > MAX_FIELD_LENGTH) {
		throw new Error("SOCKS field is longer than 255 bytes");
	}
	return [bytes.length, ...bytes];
};

const getBoundAddressLength = async (
	connection: Connection,
	addressType: number,
): Promise<number> => {
	if (addressType === ADDRESS_IPV4) {
		return IPV4_LENGTH;
	}
	if (addressType === ADDRESS_IPV6) {
		return IPV6_LENGTH;
	}
	if (addressType === ADDRESS_DOMAIN) {
		const [length = START] = await connection.readExactly(ONE_METHOD);
		return length;
	}
	throw new Error(`SOCKS proxy replied with unknown address type ${addressType}`);
};

interface ProxyConfig {
	readonly hostname: string;
	readonly password: string;
	readonly port: number;
	readonly username: string;
}

interface HttpRequest {
	readonly body: string;
	readonly headers: readonly (readonly [string, string])[];
	readonly host: string;
	readonly hostname: string;
	readonly method: string;
	readonly path: string;
}

const socksHandshake = async (
	connection: Connection,
	proxy: ProxyConfig,
	hostname: string,
): Promise<void> => {
	await connection.write([SOCKS_VERSION, ONE_METHOD, METHOD_PASSWORD]);
	const [, method] = await connection.readExactly(REPLY_LENGTH);
	if (method !== METHOD_PASSWORD) {
		throw new Error("SOCKS proxy refused username/password authentication");
	}

	await connection.write([
		AUTH_VERSION,
		...lengthPrefixed(proxy.username),
		...lengthPrefixed(proxy.password),
	]);
	const [, authStatus] = await connection.readExactly(REPLY_LENGTH);
	if (authStatus !== SUCCESS) {
		throw new Error("SOCKS proxy rejected the username or password");
	}

	await connection.write([
		SOCKS_VERSION,
		COMMAND_CONNECT,
		RESERVED,
		ADDRESS_DOMAIN,
		...lengthPrefixed(hostname),
		HTTPS_PORT_HIGH_BYTE,
		HTTPS_PORT_LOW_BYTE,
	]);
	const header = await connection.readExactly(CONNECT_HEADER_LENGTH);
	if (header[STATUS_INDEX] !== SUCCESS) {
		throw new Error(`SOCKS proxy failed to connect to ${hostname} (reply ${header[STATUS_INDEX]})`);
	}
	const addressLength = await getBoundAddressLength(
		connection,
		header[ADDRESS_TYPE_INDEX] ?? START,
	);
	await connection.readExactly(addressLength + PORT_LENGTH);
};

const dechunk = (data: string): string => {
	const lineEnd = data.indexOf(CRLF);
	const size = Number.parseInt(data.slice(START, lineEnd), HEX_RADIX);
	if (lineEnd === NOT_FOUND || Number.isNaN(size)) {
		throw new Error("Malformed chunked response from IMDb");
	}
	if (size === START) {
		return "";
	}
	const chunkStart = lineEnd + CRLF.length;
	return (
		data.slice(chunkStart, chunkStart + size) + dechunk(data.slice(chunkStart + size + CRLF.length))
	);
};

const parseResponse = (raw: string): Response => {
	const headerEnd = raw.indexOf(HEADER_END);
	if (headerEnd === NOT_FOUND) {
		throw new Error("IMDb closed the connection before sending headers");
	}

	const [statusLine = "", ...headerLines] = raw.slice(START, headerEnd).split(CRLF);
	const status = Number(statusLine.split(" ")[STATUS_INDEX]);
	const headers = new Headers(
		headerLines.map((line): [string, string] => {
			const separator = line.indexOf(":");
			return [line.slice(START, separator).trim(), line.slice(separator + NEXT).trim()];
		}),
	);

	const rest = raw.slice(headerEnd + HEADER_END.length);
	const isChunked = headers.get("transfer-encoding")?.toLowerCase().includes("chunked") === true;
	const body = isChunked ? dechunk(rest) : rest;
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

const getConnect = async (): Promise<(typeof import("cloudflare:sockets"))["connect"]> => {
	try {
		const { connect } = await import("cloudflare:sockets");
		return connect;
	} catch (error) {
		throw new Error("SOCKS proxies are only supported on Cloudflare Workers", { cause: error });
	}
};

const exchange = async (proxy: ProxyConfig, request: HttpRequest): Promise<Response> => {
	const connect = await getConnect();
	const socket = connect(
		{ hostname: proxy.hostname, port: proxy.port },
		{ allowHalfOpen: false, secureTransport: "starttls" },
	);

	try {
		const plain = openConnection(socket);
		await socksHandshake(plain, proxy, request.hostname);
		plain.release();

		const secure = openConnection(socket.startTls({ expectedServerHostname: request.hostname }));
		await secure.write(serialiseRequest(request));
		return parseResponse(await secure.readToEnd());
	} finally {
		await socket.close().catch(() => {
			// The peer may have already closed the socket
		});
	}
};

const parseProxy = (proxyUrl: string): ProxyConfig => {
	const url = new URL(proxyUrl);
	return {
		hostname: url.hostname,
		password: decodeURIComponent(url.password),
		port: url.port === "" ? DEFAULT_SOCKS_PORT : Number(url.port),
		username: decodeURIComponent(url.username),
	};
};

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Request is a mutable platform type
const toHttpRequest = async (request: Request): Promise<HttpRequest> => {
	const url = new URL(request.url);
	if (url.protocol !== "https:") {
		throw new Error("SOCKS fetch only supports https:// targets");
	}
	return {
		body: await request.text(),
		headers: [...request.headers],
		host: url.host,
		hostname: url.hostname,
		method: request.method,
		path: `${url.pathname}${url.search}`,
	};
};

const timeout = async (): Promise<never> => {
	await scheduler.wait(TIMEOUT_MS);
	throw new Error(`SOCKS request timed out after ${TIMEOUT_MS}ms`);
};

const createSocksFetch =
	(proxyUrl: string): typeof fetch =>
	// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- matches fetch's signature, whose Request/RequestInit types can't be deeply readonly
	async (...args) => {
		const request = await toHttpRequest(new Request(...args));
		return Promise.race([exchange(parseProxy(proxyUrl), request), timeout()]);
	};

export default createSocksFetch;
