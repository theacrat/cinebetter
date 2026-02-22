import { objectFromEntries, objectHasOwn, objectKeys } from "ts-extras";
import { z } from "zod";

const LANGUAGE_CODE_PART_LENGTH = 2;

const normaliseLanguageCode = (value: string): string => {
	const [language, region] = value.split("-");
	if (
		language?.length !== LANGUAGE_CODE_PART_LENGTH ||
		region?.length !== LANGUAGE_CODE_PART_LENGTH
	) {
		throw new Error(`Invalid language code: ${value}`);
	}

	return `${language.toLowerCase()}-${region.toUpperCase()}`;
};

const languageCodec = z.codec(z.string(), z.string(), {
	decode: (value) => normaliseLanguageCode(value),
	encode: (value) => value,
});

const boolCodec = z.codec(z.enum(["0", "1"]), z.boolean(), {
	decode: (value) => value === "1",
	encode: (value) => (value ? "1" : "0"),
});

type AnyCodec = z.ZodCodec<z.ZodType, z.ZodType>;

interface SettingDefinition<TParam extends string, TCodec extends z.ZodCodec> {
	readonly codec: TCodec;
	readonly defaultValue: z.input<TCodec["in"]>;
	readonly param: TParam;
}

type SettingsMap = Record<string, SettingDefinition<string, AnyCodec>>;

const defineSetting = <TParam extends string, TCodec extends AnyCodec>(
	param: TParam,
	codec: TCodec,
	defaultValue: z.input<TCodec["in"]>,
): SettingDefinition<TParam, TCodec> => ({ codec, defaultValue, param });

const SETTINGS = {
	discoverOnly: defineSetting("d", boolCodec, "0"),
	hideLowQuality: defineSetting("h", boolCodec, "0"),
	languageCode: defineSetting("l", languageCodec, "en-US"),
} as const;

const mapSettings = <TSettings extends SettingsMap, TResult>(
	settings: TSettings,
	mapper: <TKey extends keyof TSettings>(key: TKey, definition: TSettings[TKey]) => TResult,
): TResult[] =>
	objectKeys(settings).map((key) => {
		const definition = settings[key];
		if (definition === undefined) {
			throw new Error(`Missing setting definition: ${String(key)}`);
		}
		return mapper(key, definition);
	});

const isCodecShape = (
	value: Readonly<Record<string, unknown>>,
): value is Readonly<Record<string, z.ZodType>> =>
	objectKeys(value).every((shapeValue) => typeof shapeValue === "string");

const createInputShape = <TSettings extends SettingsMap>(
	settings: TSettings,
): Readonly<Record<string, z.ZodType>> => {
	const shape = objectFromEntries(
		mapSettings(settings, (key, definition) => [String(key), definition.codec.in] as const),
	);
	if (!isCodecShape(shape)) {
		throw new Error("Invalid input shape.");
	}

	return shape;
};

const createOutputShape = <TSettings extends SettingsMap>(
	settings: TSettings,
): Readonly<Record<string, z.ZodType>> => {
	const shape = objectFromEntries(
		mapSettings(settings, (key, definition) => [String(key), definition.codec.out] as const),
	);
	if (!isCodecShape(shape)) {
		throw new Error("Invalid output shape.");
	}

	return shape;
};

const SETTINGS_INPUT_SCHEMA = z.object(createInputShape(SETTINGS));
const SETTINGS_OUTPUT_SCHEMA = z.object(createOutputShape(SETTINGS));

type UserSettings = Readonly<{
	readonly [TKey in keyof typeof SETTINGS]: z.output<(typeof SETTINGS)[TKey]["codec"]["out"]>;
}>;
type EncodedSettings = {
	readonly [TKey in keyof typeof SETTINGS]: z.output<(typeof SETTINGS)[TKey]["codec"]["in"]>;
};

const hasOwnKey = <TKey extends string>(
	value: unknown,
	key: TKey,
): value is Readonly<Record<TKey, unknown>> =>
	typeof value === "object" && value !== null && objectHasOwn(value, key);

const isEncodedSettings = (value: unknown): value is EncodedSettings => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	for (const key of objectKeys(SETTINGS)) {
		if (!hasOwnKey(value, key)) {
			return false;
		}

		if (!SETTINGS[key].codec.in.safeParse(value[key]).success) {
			return false;
		}
	}

	return true;
};

const isUserSettings = (value: unknown): value is UserSettings => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	for (const key of objectKeys(SETTINGS)) {
		if (!hasOwnKey(value, key)) {
			return false;
		}

		if (!SETTINGS[key].codec.out.safeParse(value[key]).success) {
			return false;
		}
	}

	return true;
};

const parseQueryInput = (params: Readonly<URLSearchParams>): EncodedSettings => {
	const parsed = SETTINGS_INPUT_SCHEMA.parse(
		objectFromEntries(
			mapSettings(SETTINGS, (key, definition) => [
				key,
				params.get(definition.param) ?? definition.defaultValue,
			]),
		),
	);

	if (!isEncodedSettings(parsed)) {
		throw new Error("Invalid encoded settings.");
	}

	return parsed;
};

const decodeFromEncoded = (encoded: EncodedSettings): UserSettings => {
	const decoded = objectFromEntries(
		mapSettings(SETTINGS, (key, definition) => {
			const { codec }: { codec: AnyCodec } = definition;
			return [key, codec.decode(codec.in.parse(encoded[key]))] as const;
		}),
	);

	const parsed = SETTINGS_OUTPUT_SCHEMA.parse(decoded);

	if (!isUserSettings(parsed)) {
		throw new Error("Invalid decoded settings.");
	}

	return parsed;
};

const encodeToQuery = (settings: UserSettings): EncodedSettings => {
	const encoded = objectFromEntries(
		mapSettings(SETTINGS, (key, definition) => {
			const { codec }: { codec: AnyCodec } = definition;
			return [key, codec.encode(codec.out.parse(settings[key]))] as const;
		}),
	);
	const parsed = SETTINGS_INPUT_SCHEMA.parse(encoded);

	if (!isEncodedSettings(parsed)) {
		throw new Error("Invalid encoded settings.");
	}

	return parsed;
};

const DEFAULT_SETTINGS = decodeFromEncoded(
	parseQueryInput(
		new URLSearchParams(
			objectFromEntries(
				mapSettings(SETTINGS, (_key, definition) => [definition.param, definition.defaultValue]),
			),
		),
	),
);
const DEFAULT_ENCODED_SETTINGS = encodeToQuery(DEFAULT_SETTINGS);

const encodeSettings = (settings: UserSettings): URLSearchParams => {
	const encodedSettings = encodeToQuery(settings);
	const entries = mapSettings(SETTINGS, (key, definition) => {
		const value = encodedSettings[key];
		return value === DEFAULT_ENCODED_SETTINGS[key]
			? undefined
			: ([definition.param, value] as const);
	}).flatMap<[string, string]>((entry) => {
		if (entry === undefined) {
			return [];
		}

		const [param, value] = entry;
		return [[param, value]];
	});

	return new URLSearchParams(entries);
};

const decodeSettings = (queryString: string): UserSettings => {
	try {
		const encoded = parseQueryInput(new URLSearchParams(queryString));
		return decodeFromEncoded(encoded);
	} catch (error) {
		throw new Error("Invalid configuration string.", { cause: error });
	}
};

export { DEFAULT_SETTINGS, decodeSettings, encodeSettings, type UserSettings };
