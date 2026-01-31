import type { UserSettings } from '@/lib/user-settings';
import {
	Button,
	ButtonGroup,
	Checkbox,
	Flex,
	Form,
	Heading,
	Link,
	Text,
	TextField,
	Well,
} from '@adobe/react-spectrum';
import { useState } from 'react';
import { encodeSettings } from '@/lib/user-settings';

export function ConfigurePage({
	initialSettings,
}: {
	initialSettings: UserSettings;
}) {
	const [settings, setSettings] = useState<UserSettings>(initialSettings);
	const [manifestUrl, setManifestUrl] = useState<string>('');
	const [showResult, setShowResult] = useState(false);
	const [copyButtonText, setCopyButtonText] = useState('Copy URL');

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		const params = encodeSettings(settings);
		const url = `${window.location.origin}${params.size ? `/${params.toString()}` : ''}/manifest.json`;

		setManifestUrl(url);
		setShowResult(true);
	};

	const copyToClipboard = () => {
		void navigator.clipboard.writeText(manifestUrl);
		setCopyButtonText('Copied!');
		setTimeout(() => {
			setCopyButtonText('Copy URL');
		}, 2000);
	};

	const openInstallUrl = () => {
		const url = `${manifestUrl.replace(/^https?:\/\//, 'stremio://')}`;
		window.open(url, '_blank');
	};

	const openWebInstallUrl = () => {
		const url = `https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifestUrl)}`;
		window.open(url, '_blank');
	};

	return (
		<Flex
			direction="column"
			alignItems="center"
			justifyContent="center"
			minHeight="100vh"
		>
			<Well maxWidth="size-6000" width="90%">
				<Flex direction="column" alignItems="center">
					<Heading level={1}>Cinebetter</Heading>
					<Text>Configure your metadata preferences</Text>
				</Flex>

				<Form
					onSubmit={handleSubmit}
					marginBottom="size-200"
					validationBehavior="native"
				>
					<TextField
						label="Language code"
						value={settings.languageCode}
						onChange={v => setSettings({ ...settings, languageCode: v })}
						description="e.g., en-US, pt-BR, fr-FR"
						pattern={/^[a-zA-Z]{2}-[a-zA-Z]{2}$/.source}
						errorMessage="Please use a format like en-US. Only 2 letter segments are supported."
					/>

					<Flex direction="column" gap="size-50" marginBottom="size-200">
						<Checkbox
							isSelected={settings.discoverOnly}
							onChange={isSelected =>
								setSettings({ ...settings, discoverOnly: isSelected })}
						>
							<Flex direction="column">
								<Text>Hide catalogs from homescreen</Text>
							</Flex>
						</Checkbox>
						<Checkbox
							isSelected={settings.hideLowQuality}
							onChange={isSelected =>
								setSettings({ ...settings, hideLowQuality: isSelected })}
						>
							<Flex direction="column">
								<Text>Hide low quality content from search results</Text>
								<Text UNSAFE_className="checkbox-description">
									Attempts to hide duplicates, reaction videos, podcasts, etc.,
									but may exclude some legitimate entries.
								</Text>
							</Flex>
						</Checkbox>
					</Flex>

					<Button type="submit" variant="cta" width="100%">
						Generate Manifest URL
					</Button>
				</Form>

				{showResult && (
					<Flex direction="column" gap="size-200">
						<Well>
							<Text
								UNSAFE_style={{
									fontFamily: 'monospace',
									wordBreak: 'break-all',
								}}
							>
								{manifestUrl}
							</Text>
						</Well>
						<ButtonGroup>
							<Button onPress={copyToClipboard} variant="primary">
								{copyButtonText}
							</Button>
							<Button
								onPress={openInstallUrl}
								variant="secondary"
							>
								Install in Stremio App
							</Button>
							<Button
								onPress={openWebInstallUrl}
								variant="secondary"
							>
								Install in Web
							</Button>
						</ButtonGroup>
						<Text>
							After installing, you can use
							{' '}
							<Link
								href="https://addon-manager.thea.dev/"
								target="_blank"
								rel="noopener noreferrer"
							>
								Unprotected Stremio Addon Manager
							</Link>
							{' '}
							to uninstall Cinemeta.
						</Text>
					</Flex>
				)}
			</Well>
		</Flex>
	);
}
