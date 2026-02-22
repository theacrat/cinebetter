import { Form, TextField, Checkbox, Button, Text } from "@adobe/react-spectrum";
import type { JSX } from "react";

import useConfigureForm from "@/components/configure/use-configure-form";
import type { UserSettings } from "@/lib/user-settings";

interface ConfigureFormProps {
	readonly setManifestUrl: (url: string) => void;
	readonly initialSettings: UserSettings;
	readonly enableTmdb: boolean;
}

const NO_TOKEN = (
	<>
		<br />
		<Text UNSAFE_className="error-text">
			TMDB_TOKEN needs to be set on the server to use this option.
		</Text>
	</>
);

const ConfigureForm = ({
	initialSettings,
	setManifestUrl,
	enableTmdb,
}: ConfigureFormProps): JSX.Element => {
	const { settings, onLanguageChange, onDiscoverOnlyChange, onHideLowQualityChange, onSubmit } =
		useConfigureForm({ initialSettings, setManifestUrl });

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
			<Checkbox
				isDisabled={!enableTmdb}
				isSelected={settings.hideLowQuality}
				onChange={onHideLowQualityChange}
			>
				<Text>Hide low quality content from search results</Text>
				<br />
				<Text UNSAFE_className="checkbox-description">
					Attempts to hide duplicates, reaction videos, podcasts, etc., but may exclude some
					legitimate entries.
				</Text>
				{!enableTmdb && NO_TOKEN}
			</Checkbox>
			<Button type="submit" variant="cta" width="100%" marginTop="size-200">
				Generate Manifest URL
			</Button>
		</Form>
	);
};

export default ConfigureForm;
