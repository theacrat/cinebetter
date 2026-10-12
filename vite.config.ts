import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import type { ExternalOption } from "rollup";
import type { PluginOption } from "vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig(() => {
	const cf = process.env.CF !== undefined;
	const unavailableShim = fileURLToPath(new URL("src/shims/unavailable.ts", import.meta.url));

	const plugins: PluginOption[] = [
		devtools(),
		cf ? cloudflare({ viteEnvironment: { name: "ssr" } }) : nitro({ output: { dir: "dist" } }),
		viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
		tanstackStart(),
		viteReact(),
	];

	const alias: Record<string, string> = {
		"@": fileURLToPath(new URL("src", import.meta.url)),
		...(cf
			? { "@valkey/valkey-glide": unavailableShim }
			: { "cloudflare:sockets": unavailableShim, "cloudflare:workers": unavailableShim }),
	};

	const external: ExternalOption =
		process.env.CF === undefined
			? ["@valkey/valkey-glide", "@libsql/client"]
			: ["@valkey/valkey-glide"];

	return {
		build: {
			rollupOptions: {
				external,
				output: {
					manualChunks(id: string): string | undefined {
						if (/macro-.*\.css$/.test(id) || /@react-spectrum\/s2\/.*\.css$/.test(id)) {
							return "s2-styles";
						}

						return undefined;
					},
				},
			},
		},
		optimizeDeps: {
			exclude: ["@valkey/valkey-glide"],
		},
		plugins,
		resolve: {
			alias,
		},
		server: {
			cors: true,
		},
		ssr: {
			noExternal: ["@adobe/react-spectrum", /^@react-spectrum\/.*/, /^@spectrum-icons\/.*/],
		},
	};
});

export default config;
