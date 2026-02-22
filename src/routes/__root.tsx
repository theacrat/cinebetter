import { defaultTheme, Provider } from "@adobe/react-spectrum";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { JSX, ReactNode } from "react";
import type { ReadonlyDeep } from "type-fest";

import appCss from "@/styles.css?url";

const DEVTOOLS_CONFIG = { position: "bottom-right" } as const;
const DEVTOOLS_PLUGINS = [{ name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> }];

const HEAD_LINKS = [{ href: appCss, rel: "stylesheet" }];
const HEAD_META = [
	{ charSet: "utf8" },
	{ content: "width=device-width, initial-scale=1", name: "viewport" },
	{ title: "Cinebetter" },
];

interface RootDocumentProps {
	readonly children: ReactNode;
}

export const Route = createRootRoute({
	head: () => ({
		links: HEAD_LINKS,
		meta: HEAD_META,
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: ReadonlyDeep<RootDocumentProps>): JSX.Element {
	const body = (
		<body>
			<Provider colorScheme="dark" theme={defaultTheme}>
				{children}
				<TanStackDevtools config={DEVTOOLS_CONFIG} plugins={DEVTOOLS_PLUGINS} />
				<Scripts />
			</Provider>
		</body>
	);

	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			{body}
		</html>
	);
}
