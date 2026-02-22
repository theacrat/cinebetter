import { ButtonGroup, Button, Link, Text, Flex, Well } from "@adobe/react-spectrum";
import { useCallback, useState } from "react";
import type { JSX } from "react";

const COPY_TEXT = "Copy URL";
const COPIED_TEXT = "Copied!";
const COPY_DELAY_MS = 2000;

const MONOSPACE_STYLE = {
	fontFamily: "monospace",
	wordBreak: "break-all",
} as const;

interface ConfigureResultProps {
	readonly manifestUrl: string;
}

const ConfigureResult = ({ manifestUrl }: ConfigureResultProps): JSX.Element => {
	const [copyButtonText, setCopyButtonText] = useState(COPY_TEXT);

	const onCopy = useCallback((): void => {
		try {
			void navigator.clipboard.writeText(manifestUrl);
			setCopyButtonText(COPIED_TEXT);
			setTimeout(() => {
				setCopyButtonText(COPY_TEXT);
			}, COPY_DELAY_MS);
		} catch {}
	}, [manifestUrl]);

	const onInstall = useCallback((): void => {
		const installUrl = manifestUrl.replace(/^https?:\/\//, "stremio://");
		window.open(installUrl, "_blank");
	}, [manifestUrl]);

	const onWebInstall = useCallback((): void => {
		const webInstallUrl = `https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifestUrl)}`;
		window.open(webInstallUrl, "_blank");
	}, [manifestUrl]);

	return (
		<Flex direction="column" gap="size-200">
			<Well>
				<Text UNSAFE_style={MONOSPACE_STYLE}>{manifestUrl}</Text>
			</Well>
			<ButtonGroup>
				<Button onPress={onCopy} variant="primary">
					{copyButtonText}
				</Button>
				<Button onPress={onInstall} variant="secondary">
					Install in Stremio App
				</Button>
				<Button onPress={onWebInstall} variant="secondary">
					Install in Web
				</Button>
			</ButtonGroup>
			<Text>
				After installing, you can use{" "}
				<Link href="https://addon-manager.thea.dev/" target="_blank" rel="noopener noreferrer">
					Unprotected Stremio Addon Manager
				</Link>{" "}
				to uninstall Cinemeta.
			</Text>
		</Flex>
	);
};

export default ConfigureResult;
