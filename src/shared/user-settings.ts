import { HTTPException } from "hono/http-exception";

type SettingType = string | boolean;

interface SettingConfig<T extends SettingType> {
	param: string;
	default: T;
	encode: (value: T) => string;
	decode: (value: string | null, d: T) => T;
}

export type UserSettings = {
	[K in keyof typeof SETTINGS_CONFIG]: (typeof SETTINGS_CONFIG)[K] extends SettingConfig<
		infer V
	>
		? V
		: never;
};

type SettingsConfigType = typeof SETTINGS_CONFIG;

function getLanguageCode(language: string) {
	const splitLanguageCode = language.split("-");
	if (
		splitLanguageCode.length !== 2 ||
		splitLanguageCode.find((s) => s.length !== 2)
	) {
		throw new Error(`Invalid language code: ${language}`);
	}

	return `${splitLanguageCode[0].toLowerCase()}-${splitLanguageCode[1].toUpperCase()}`;
}

const getSettingsEntries = (
	config: SettingsConfigType,
): Array<[keyof SettingsConfigType, SettingConfig<SettingType>]> =>
	Object.entries(config) as Array<
		[keyof SettingsConfigType, SettingConfig<SettingType>]
	>;

const createDefaultSettings = (config: SettingsConfigType): UserSettings => {
	const entries = getSettingsEntries(config);

	return entries.reduce(
		(defaults, [key, { default: defaultValue }]) => ({
			...defaults,
			[key]: defaultValue,
		}),
		{} as UserSettings,
	);
};

const boolSetting = (
	param: string,
	defaultValue = false,
): SettingConfig<boolean> => ({
	param,
	default: defaultValue,
	encode: (v) => (v ? "1" : "0"),
	decode: (v, d) => {
		switch (v) {
			case null:
				return d;
			case "0":
				return false;
			case "1":
				return true;
			default:
				throw new Error(`Invalid boolean value "${v}" on ${param}`);
		}
	},
});

const stringSetting = (
	param: string,
	defaultValue: string,
	encode: (value: string) => string,
	decode: (value: string | null, d: string) => string,
): SettingConfig<string> => ({
	param,
	default: defaultValue,
	encode,
	decode,
});

const SETTINGS_CONFIG = {
	languageCode: stringSetting(
		"l",
		"en-US",
		getLanguageCode,
		(v: string | null, d: string) => getLanguageCode(v || d),
	),
	hideLowQuality: boolSetting("h"),
	discoverOnly: boolSetting("d"),
};

export const DEFAULT_SETTINGS: UserSettings =
	createDefaultSettings(SETTINGS_CONFIG);

export function encodeSettings(settings: UserSettings): URLSearchParams {
	const params = new URLSearchParams();

	getSettingsEntries(SETTINGS_CONFIG).forEach(([settingKey, config]) => {
		const value = settings[settingKey];
		const defaultValue = DEFAULT_SETTINGS[settingKey];

		if (value === defaultValue) {
			return;
		}

		params.set(config.param, config.encode(value));
	});

	return params;
}

export function decodeSettings(queryString: string): UserSettings {
	try {
		const params = new URLSearchParams(queryString);

		return getSettingsEntries(SETTINGS_CONFIG).reduce<UserSettings>(
			(settings, [settingKey, config]) => {
				const paramValue = params.get(config.param);

				return {
					...settings,
					[settingKey]: config.decode(paramValue, config.default),
				};
			},
			DEFAULT_SETTINGS,
		);
	} catch (e) {
		if (e instanceof Error) {
			console.error("decodeSettings Error:", e?.message);
		}
		throw new HTTPException(400, {
			message: "Invalid configuration string.",
			cause: e,
		});
	}
}
