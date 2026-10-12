import { openConnection } from "@/lib/socks/connection";
import type { Socket } from "@/lib/socks/connection";
import { socksHandshake } from "@/lib/socks/handshake";
import type { ProxyCredentials } from "@/lib/socks/handshake";
import { parseResponse, serialiseRequest } from "@/lib/socks/http";
import type { HttpRequest } from "@/lib/socks/http";

const DEFAULT_SOCKS_PORT = 1080;
const SCHEME_DEFAULT_PORT = "";
const TIMEOUT_MS = 15_000;

interface ProxyConfig extends ProxyCredentials {
	readonly hostname: string;
	readonly port: number;
}

type Connect = (typeof import("cloudflare:sockets"))["connect"];

const getConnect = async (): Promise<Connect> => {
	try {
		const { connect } = await import("cloudflare:sockets");
		return connect;
	} catch (error) {
		throw new Error("SOCKS proxies are only supported on Cloudflare Workers", { cause: error });
	}
};

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a Socket is a mutable platform type
const closeQuietly = async (socket: Socket | undefined): Promise<void> => {
	await socket?.close().catch(() => {
		// The peer may have already closed the socket
	});
};

interface ExchangeOptions {
	readonly connect: Connect;
	readonly proxy: ProxyConfig;
	readonly request: HttpRequest;
	readonly signal: AbortSignal;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- AbortSignal is a mutable platform type
const whenAborted = async (signal: AbortSignal): Promise<never> =>
	// oxlint-disable-next-line promise/avoid-new -- AbortSignal only exposes an event, so it has to be wrapped
	new Promise((_resolve, reject) => {
		signal.addEventListener(
			"abort",
			() => {
				reject(new Error(`SOCKS request aborted: ${String(signal.reason)}`));
			},
			{ once: true },
		);
	});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- AbortSignal is a mutable platform type
const exchange = async ({
	connect,
	proxy,
	request,
	signal,
}: ExchangeOptions): Promise<Response> => {
	signal.throwIfAborted();
	const socket = connect(
		{ hostname: proxy.hostname, port: proxy.port },
		{ allowHalfOpen: false, secureTransport: "starttls" },
	);
	let secureSocket: Socket | undefined = undefined;

	const run = async (): Promise<Response> => {
		const plain = openConnection(socket);
		await socksHandshake(plain, proxy, request.hostname);
		plain.release();

		secureSocket = socket.startTls({ expectedServerHostname: request.hostname });
		const secure = openConnection(secureSocket);
		await secure.write(serialiseRequest(request));
		return parseResponse(await secure.readToEnd());
	};

	try {
		return await Promise.race([run(), whenAborted(signal)]);
	} finally {
		// Not awaited: close() can hang on a socket that never finished connecting
		void closeQuietly(secureSocket);
		void closeQuietly(socket);
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
	if (url.protocol !== "https:" || url.port !== SCHEME_DEFAULT_PORT) {
		throw new Error("SOCKS fetch only supports https:// targets on port 443");
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

const createSocksFetch = (proxyUrl: string): typeof fetch => {
	const proxy = parseProxy(proxyUrl);

	// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- matches fetch's signature, whose Request/RequestInit types can't be deeply readonly
	return async (...args) => {
		const connect = await getConnect();
		const incoming = new Request(...args);
		const signal = AbortSignal.any([incoming.signal, AbortSignal.timeout(TIMEOUT_MS)]);
		return exchange({ connect, proxy, request: await toHttpRequest(incoming), signal });
	};
};

export default createSocksFetch;
