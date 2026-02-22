import { Flex, Heading, Text, Well } from "@adobe/react-spectrum";
import type { JSX } from "react";
import { useState } from "react";

import type { UserSettings } from "@/lib/user-settings";

import ConfigureForm from "./configure-form";
import ConfigureResult from "./configure-result";

interface ConfigurePageProps {
	readonly initialSettings: UserSettings;
}

const HEADING = (
	<Flex direction="column" alignItems="center">
		<Heading level={1}>Cinebetter</Heading>
		<Text>Configure your metadata preferences</Text>
	</Flex>
);

const ConfigurePage = ({ initialSettings }: ConfigurePageProps): JSX.Element => {
	const [manifestUrl, setManifestUrl] = useState<string>("");

	return (
		<Flex
			alignItems="center"
			direction="column"
			gap="size-200"
			justifyContent="center"
			minHeight="100vh"
		>
			<Well maxWidth="size-6000" width="90%">
				{HEADING}
				<ConfigureForm setManifestUrl={setManifestUrl} initialSettings={initialSettings} />
				{manifestUrl !== "" && <ConfigureResult manifestUrl={manifestUrl} />}
			</Well>
		</Flex>
	);
};

export default ConfigurePage;
