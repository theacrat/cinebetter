import { objectEntries, objectFromEntries } from 'ts-extras';
import { z } from 'zod';

const languageCodec = z.codec(z.string(), z.string(), {
	decode: v => normaliseLanguageCode(v),
	encode: v => v,
});

const boolCodec = z.codec(z.enum(['0', '1']), z.boolean(), {
	decode: v => v === '1',
	encode: v => (v ? '1' : '0'),
});

const { paramsSchema, settingsSchema: _settingsSchema, codec: settingsCodec } = createSettingsCodec({
	languageCode: defineSetting('l', z.string(), z.string(), languageCodec, 'en-US'),
	hideLowQuality: defineSetting('h', z.enum(['0', '1']), z.boolean(), boolCodec, '0'),
	discoverOnly: defineSetting('d', z.enum(['0', '1']), z.boolean(), boolCodec, '0'),
});

function defineSetting<
	TParam extends string,
	TParamSchema extends z.ZodTypeAny,
	TSettingsSchema extends z.ZodTypeAny,
>(
	param: TParam,
	paramSchema: TParamSchema,
	settingsSchema: TSettingsSchema,
	codec: z.ZodCodec<z.ZodTypeAny, z.ZodTypeAny>,
	defaultValue: z.input<TParamSchema>,
) {
	return { param, paramSchema, settingsSchema, codec, default: defaultValue };
}

function createSettingsCodec<
	TMapping extends Record<string, ReturnType<typeof defineSetting>>,
>(mapping: TMapping) {
	type ParamsShape = {
		[K in keyof TMapping as TMapping[K]['param']]: z.ZodDefault<TMapping[K]['paramSchema']>;
	};
	type SettingsShape = {
		[K in keyof TMapping]: TMapping[K]['settingsSchema'];
	};

	const paramsSchema = z.object(
		objectFromEntries(
			objectEntries(mapping).map(([, def]) => [def.param, def.paramSchema.default(def.default)]),
		),
	) as z.ZodObject<ParamsShape>;

	const settingsSchema = z.object(
		objectFromEntries(
			objectEntries(mapping).map(([key, def]) => [key, def.settingsSchema]),
		),
	) as z.ZodObject<SettingsShape>;

	const codec = z.codec(paramsSchema, settingsSchema, {
		decode: (params: Record<string, unknown>) =>
			objectFromEntries(
				objectEntries(mapping).map(([settingsKey, { param, codec }]) => [
					settingsKey,
					codec.decode(params[param]),
				]),
			),
		encode: (settings: Record<string, unknown>) =>
			objectFromEntries(
				objectEntries(mapping).map(([settingsKey, { param, codec }]) => [
					param,
					codec.encode(settings[settingsKey]),
				]),
			),
	} as unknown as Parameters<typeof z.codec<typeof paramsSchema, typeof settingsSchema>>[2]);

	return { paramsSchema, settingsSchema, codec };
}

function normaliseLanguageCode(value: string) {
	const [lang, region] = value.split('-');
	if (lang?.length !== 2 || region?.length !== 2) {
		throw new Error(`Invalid language code: ${value}`);
	}
	return `${lang.toLowerCase()}-${region.toUpperCase()}`;
}

export type UserSettings = z.output<typeof _settingsSchema>;

export const DEFAULT_SETTINGS: UserSettings = settingsCodec.decode({});

export function encodeSettings(settings: UserSettings): URLSearchParams {
	const encoded = settingsCodec.encode(settings);
	const encodedDefault = settingsCodec.encode(DEFAULT_SETTINGS);
	const params = new URLSearchParams();

	objectEntries(encoded).forEach(([k, v]) => {
		if (v != null && v !== encodedDefault[k]) {
			params.set(k, v);
		}
	});

	return params;
}

export function decodeSettings(queryString: string): UserSettings {
	const urlParams = new URLSearchParams(queryString);
	const paramEntries = objectFromEntries([...urlParams.entries()]);

	try {
		return settingsCodec.decode(paramEntries);
	}
	catch (e) {
		if (e instanceof Error) {
			console.error(paramsSchema.parse(paramEntries));
		}
		throw new Error('Invalid configuration string.', {
			cause: e,
		});
	}
}
