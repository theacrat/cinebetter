import { useCallback, useState } from "react";
import type { SyntheticEvent } from "react";

import { encodeSettings } from "@/lib/user-settings";
import type { UserSettings } from "@/lib/user-settings";

const EMPTY_QUERY_SIZE = 0;
const MANIFEST_PATH = "/manifest.json";

interface UseConfigureFormProps {
	readonly initialSettings: UserSettings;
	readonly setManifestUrl: (url: string) => void;
}

const buildManifestUrl = (settings: UserSettings): string => {
	const params = encodeSettings(settings);
	const settingsPath = params.size > EMPTY_QUERY_SIZE ? `/${params.toString()}` : "";
	return `${globalThis.location.origin}${settingsPath}${MANIFEST_PATH}`;
};

const useConfigureForm = ({
	initialSettings,
	setManifestUrl,
}: UseConfigureFormProps): {
	readonly settings: UserSettings;
	readonly onLanguageChange: (languageCode: string) => void;
	readonly onDiscoverOnlyChange: (discoverOnly: boolean) => void;
	readonly onHideLowQualityChange: (hideLowQuality: boolean) => void;
	readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
} => {
	const [settings, setSettings] = useState<UserSettings>(initialSettings);

	const onLanguageChange = useCallback((languageCode: string): void => {
		setSettings((previousSettings) => ({ ...previousSettings, languageCode }));
	}, []);

	const onDiscoverOnlyChange = useCallback((discoverOnly: boolean): void => {
		setSettings((previousSettings) => ({ ...previousSettings, discoverOnly }));
	}, []);

	const onHideLowQualityChange = useCallback((hideLowQuality: boolean): void => {
		setSettings((previousSettings) => ({ ...previousSettings, hideLowQuality }));
	}, []);

	const onSubmit = useCallback(
		(event: SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();

			setManifestUrl(buildManifestUrl(settings));
		},
		[setManifestUrl, settings],
	);

	return { onDiscoverOnlyChange, onHideLowQualityChange, onLanguageChange, onSubmit, settings };
};

export default useConfigureForm;
