import { createHash, timingSafeEqual } from "node:crypto";
import process from "node:process";

const DEFAULT_PORT = 41_873;
const FORBIDDEN_STATUS = 403;
const METHOD_NOT_ALLOWED_STATUS = 405;
const BAD_GATEWAY_STATUS = 502;
const IMDB_GRAPHQL_URL = "https://api.graphql.imdb.com/";
const PROXY_TOKEN_HEADER = "x-proxy-token";
const FORWARDED_HEADERS = [
	"content-type",
	"user-agent",
	"x-imdb-client-name",
	"x-imdb-user-country",
	"x-imdb-user-language",
] as const;

const token = process.env["IMDB_PROXY_TOKEN"];
if (token === undefined || token === "") {
	throw new Error("IMDB_PROXY_TOKEN must be set");
}

const hash = (value: string): Buffer => createHash("sha256").update(value).digest();
const tokenHash = hash(token);

const isAuthorised = (provided: string | null): boolean =>
	provided !== null && timingSafeEqual(hash(provided), tokenHash);

const pickHeaders = (source: Readonly<Headers>): Headers => {
	const headers = new Headers();
	for (const name of FORWARDED_HEADERS) {
		const value = source.get(name);
		if (value !== null) {
			headers.set(name, value);
		}
	}
	return headers;
};

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Bun hands us a mutable Request and we only read from it
const handle = async (request: Request): Promise<Response> => {
	if (!isAuthorised(request.headers.get(PROXY_TOKEN_HEADER))) {
		return new Response("Forbidden", { status: FORBIDDEN_STATUS });
	}

	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: METHOD_NOT_ALLOWED_STATUS });
	}

	try {
		const upstream = await fetch(IMDB_GRAPHQL_URL, {
			body: await request.text(),
			headers: pickHeaders(request.headers),
			method: "POST",
		});

		return new Response(upstream.body, {
			headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
			status: upstream.status,
		});
	} catch {
		return new Response("Bad Gateway", { status: BAD_GATEWAY_STATUS });
	}
};

const server = {
	fetch: handle,
	port: Number(process.env["IMDB_PROXY_PORT"] ?? DEFAULT_PORT),
};

export default server;
