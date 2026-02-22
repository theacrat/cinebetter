import { Form, TextField, Checkbox, Button, Text } from "@adobe/react-spectrum";
import { useCallback, useState } from "react";
import type { JSX, SyntheticEvent } from "react";

import { encodeSettings } from "@/lib/user-settings";
import type { UserSettings } from "@/lib/user-settings";

const EMPTY_QUERY_SIZE = 0;
const MANIFEST_PATH = "/manifest.json";

interface ConfigureFormProps {
	readonly setManifestUrl: (url: string) => void;
	readonly initialSettings: UserSettings;
}

const buildManifestUrl = (settings: UserSettings): string => {
	const params = encodeSettings(settings);
	const settingsPath = params.size > EMPTY_QUERY_SIZE ? `/${params.toString()}` : "";
	return `${globalThis.location.origin}${settingsPath}${MANIFEST_PATH}`;
};

const ConfigureForm = ({ initialSettings, setManifestUrl }: ConfigureFormProps): JSX.Element => {
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

	return (
		<Form marginBottom="size-200" onSubmit={onSubmit} validationBehavior="native">
			<TextField
				description="e.g., en-US, pt-BR, fr-FR"
				errorMessage="Please use a format like en-US. Only 2 letter segments are supported."
				label="Language code"
				onChange={onLanguageChange}
				pattern={/^[a-zA-Z]{2}-[a-zA-Z]{2}$/.source}
				value={settings.languageCode}
			/>
			<Checkbox isSelected={settings.discoverOnly} onChange={onDiscoverOnlyChange}>
				Hide catalogs from homescreen
			</Checkbox>
			<Checkbox isSelected={settings.hideLowQuality} onChange={onHideLowQualityChange}>
				<Text>Hide low quality content from search results</Text>
				<br />
				<Text UNSAFE_className="checkbox-description">
					Attempts to hide duplicates, reaction videos, podcasts, etc., but may exclude some
					legitimate entries.
				</Text>
			</Checkbox>
			<Button type="submit" variant="cta" width="100%" marginTop="size-200">
				Generate Manifest URL
			</Button>
		</Form>
	);
};

export default ConfigureForm;
