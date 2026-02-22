/* eslint-disable require-await */
import { Buffer } from "node:buffer";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";

import type { Decoder, GlideClient, HashDataType } from "@valkey/valkey-glide";
import { objectKeys } from "ts-extras";
import type { ReadonlyDeep } from "type-fest";

import env from "@/env";
import type { CacheAdapter, CachePutOptions } from "@/lib/cache";
import { daysToCacheTime, setHeaders } from "@/utils/cache";
import stripUndefined from "@/utils/strip-undefined";

interface CacheData extends Record<string, Buffer> {
	readonly body: Buffer;
	readonly timestamp: Buffer;
	readonly ttl: Buffer;
}

interface ValkeyModule {
	readonly Decoder: {
		readonly Bytes: Decoder;
	};
	readonly GlideClient: {
		readonly createClient: (options: Readonly<Record<string, unknown>>) => Promise<GlideClient>;
	};
}

declare global {
	var __cinebetterValkeyModulePromise: Promise<ValkeyModule | undefined> | undefined;
	var __cinebetterValkeyClientPromise: Promise<GlideClient | undefined> | undefined;
	var __cinebetterValkeyAdapterPromise: Promise<CacheAdapter | undefined> | undefined;
}

const isValkeyModule = (value: unknown): value is ValkeyModule =>
	typeof value === "object" && value !== null && "Decoder" in value && "GlideClient" in value;

const getValkey = async (): Promise<ValkeyModule | undefined> => {
	globalThis.__cinebetterValkeyModulePromise ??= (async (): Promise<ValkeyModule | undefined> => {
		try {
			const valkey = await import("@valkey/valkey-glide");
			return isValkeyModule(valkey) ? valkey : undefined;
		} catch {
			return undefined;
		}
	})();

	return globalThis.__cinebetterValkeyModulePromise;
};

const getBufferField = (data: ReadonlyDeep<HashDataType>, field: string): Buffer | undefined => {
	for (const entry of data) {
		if (entry.field.toString() === field && entry.value instanceof Buffer) {
			return entry.value;
		}
	}

	return undefined;
};

const parseCacheResponse = (data: ReadonlyDeep<HashDataType>): CacheData | undefined => {
	const body = getBufferField(data, "body");
	const ttl = getBufferField(data, "ttl");
	const timestamp = getBufferField(data, "timestamp");

	if (body === undefined || ttl === undefined || timestamp === undefined) {
		return undefined;
	}

	return { body, timestamp, ttl };
};

const createValkeyClient = async (valkey: ValkeyModule): Promise<GlideClient | undefined> => {
	const { VALKEY_HOST, VALKEY_PASSWORD, VALKEY_PORT, VALKEY_TLS, VALKEY_USERNAME } = env;

	if (VALKEY_HOST === undefined) {
		return undefined;
	}

	return valkey.GlideClient.createClient(
		stripUndefined<Record<string, unknown>>({
			addresses: [{ host: VALKEY_HOST, port: VALKEY_PORT }],
			credentials:
				VALKEY_PASSWORD === undefined
					? undefined
					: stripUndefined({
							password: VALKEY_PASSWORD,
							username: VALKEY_USERNAME,
						}),
			useTLS: VALKEY_PASSWORD === undefined ? undefined : VALKEY_TLS,
		}),
	);
};

const getValkeyClient = async (valkey: ValkeyModule): Promise<GlideClient | undefined> => {
	globalThis.__cinebetterValkeyClientPromise ??= createValkeyClient(valkey);
	return globalThis.__cinebetterValkeyClientPromise;
};

const createValkeyCacheAdapter = async (): Promise<CacheAdapter | undefined> => {
	globalThis.__cinebetterValkeyAdapterPromise ??= (async (): Promise<CacheAdapter | undefined> => {
		const valkey = await getValkey();
		if (valkey === undefined) {
			return undefined;
		}

		const client = await getValkeyClient(valkey);
		if (client === undefined) {
			return undefined;
		}

		return {
			match: async (
				req: ReadonlyDeep<Request>,
				maxCacheDays: number,
			): Promise<Response | undefined> => {
				const data = await client.hgetall(req.url, { decoder: valkey.Decoder.Bytes });
				const cacheData = parseCacheResponse(data);

				if (cacheData === undefined) {
					return undefined;
				}

				try {
					const body = new Uint8Array(await promisify(gunzip)(cacheData.body));
					const ttl = Number.parseInt(cacheData.ttl.toString(), 10);
					const date = new Date(cacheData.timestamp.toString());

					const headers = setHeaders(new Headers(), ttl, date);

					await client.expire(req.url, daysToCacheTime(maxCacheDays));

					return new Response(body, { headers });
				} catch {
					await client.hdel(req.url, objectKeys(cacheData));
					return undefined;
				}
			},
			put: async ({ maxCacheDays, req, res, ttlDays }: ReadonlyDeep<CachePutOptions>) => {
				const body = await res.arrayBuffer();
				const ttl = daysToCacheTime(ttlDays);

				const cacheData: CacheData = {
					body: await promisify(gzip)(body),
					timestamp: Buffer.from(new Date().toISOString()),
					ttl: Buffer.from(ttl.toString()),
				};

				await client.hset(req.url, cacheData);
				await client.expire(req.url, daysToCacheTime(maxCacheDays));
			},
		};
	})();

	return globalThis.__cinebetterValkeyAdapterPromise;
};

export { createValkeyCacheAdapter, createValkeyClient };
