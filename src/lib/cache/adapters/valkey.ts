import type { GlideClient, HashDataType } from '@valkey/valkey-glide';
import type { CacheAdapter } from '..';
import { Buffer } from 'node:buffer';
import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';
import { z } from 'zod';
import { env } from '@/env';
import { daysToCacheTime } from '..';

interface CacheData extends Record<string, Buffer> {
	body: Buffer;
	headers: Buffer;
}

async function getValkey() {
	try {
		return await import('@valkey/valkey-glide');
	}
	catch {
		return undefined;
	}
}

function parseCacheResponse(data: HashDataType) {
	const body = data.find(v => v.field.toString() === 'body')?.value;
	const headers = data.find(v => v.field.toString() === 'headers')?.value;

	if (!(body instanceof Buffer) || !(headers instanceof Buffer)) {
		return;
	}

	return { body, headers };
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
		match: async (req) => {
			const data = await client.hgetall(req.url, { decoder: valkey.Decoder.Bytes });
			const cacheData = parseCacheResponse(data);

			if (!cacheData) {
				return;
			}

			try {
				const processedBody = new Uint8Array(await promisify(gunzip)(cacheData.body));
				const processedHeaders = z.record(z.string(), z.string()).parse(JSON.parse(cacheData.headers.toString()));

				return new Response(processedBody, { headers: processedHeaders });
			}
			catch {
				await client.hdel(req.url, Object.keys(cacheData));
				return undefined;
			}
		},
		put: async (req, res, ttlDays) => {
			const body = await res.arrayBuffer();
			const headers = JSON.stringify(Object.fromEntries(res.headers));

			const cacheData: CacheData = {
				body: await promisify(gzip)(body),
				headers: Buffer.from(headers),
			};

			await client.hset(req.url, cacheData);
			await client.expire(req.url, daysToCacheTime(ttlDays));
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
