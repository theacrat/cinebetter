import type { GlideClient, HashDataType } from '@valkey/valkey-glide';
import type { CacheAdapter } from '..';
import { Buffer } from 'node:buffer';
import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';
import { env } from '@/env';
import { daysToCacheTime, setHeaders } from '@/utils/cache';

interface CacheData extends Record<string, Buffer> {
	body: Buffer;
	ttl: Buffer;
	timestamp: Buffer;
}

async function getValkey() {
	try {
		return await import('@valkey/valkey-glide');
	}
	catch {
		return undefined;
	}
}

function getBufferField(data: HashDataType, field: string): Buffer | undefined {
	const value = data.find(v => v.field.toString() === field)?.value;
	return value instanceof Buffer ? value : undefined;
}

function parseCacheResponse(data: HashDataType): CacheData | undefined {
	const body = getBufferField(data, 'body');
	const ttl = getBufferField(data, 'ttl');
	const timestamp = getBufferField(data, 'timestamp');

	if (!body || !ttl || !timestamp) {
		return;
	}

	return { body, ttl, timestamp };
}

export async function createValkeyCacheAdapter(): Promise<CacheAdapter | undefined> {
	const valkey = await getValkey();

	if (!valkey) {
		return;
	}

	const client = await createValkeyClient(valkey);

	if (!client) {
		return;
	}

	return {
		match: async (req, maxCacheDays) => {
			const data = await client.hgetall(req.url, { decoder: valkey.Decoder.Bytes });
			const cacheData = parseCacheResponse(data);

			if (!cacheData) {
				return;
			}

			try {
				const body = new Uint8Array(await promisify(gunzip)(cacheData.body));
				const ttl = Number.parseInt(cacheData.ttl.toString());
				const date = new Date(cacheData.timestamp.toString());

				const headers = new Headers();
				setHeaders(headers, ttl, date);

				void client.expire(req.url, daysToCacheTime(maxCacheDays));

				return new Response(body, { headers });
			}
			catch {
				await client.hdel(req.url, Object.keys(cacheData));
				return undefined;
			}
		},
		put: async (req, res, ttlDays, maxCacheDays) => {
			const body = await res.arrayBuffer();
			const ttl = daysToCacheTime(ttlDays);

			const cacheData: CacheData = {
				body: await promisify(gzip)(body),
				ttl: Buffer.from(ttl.toString()),
				timestamp: Buffer.from(new Date().toISOString()),
			};

			await client.hset(req.url, cacheData);
			await client.expire(req.url, daysToCacheTime(maxCacheDays));
		},
	};
}

export async function createValkeyClient(valkey: NonNullable<Awaited<ReturnType<typeof getValkey>>>): Promise<GlideClient | undefined> {
	const { VALKEY_HOST, VALKEY_PORT, VALKEY_USERNAME, VALKEY_PASSWORD, VALKEY_TLS } = env;

	if (VALKEY_HOST == null) {
		return;
	}

	return valkey.GlideClient.createClient({
		addresses: [{ host: VALKEY_HOST, port: VALKEY_PORT }],
		...(VALKEY_PASSWORD != null && {
			credentials: {
				...(VALKEY_USERNAME != null && { username: VALKEY_USERNAME }),
				password: VALKEY_PASSWORD,
			},
			useTLS: VALKEY_TLS,
		}),
	});
}
