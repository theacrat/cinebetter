import type { ExternalOption } from 'rollup';
import type { PluginOption } from 'vite';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';

const config = defineConfig(() => {
	const plugins: PluginOption[] = [
		devtools(),
		cloudflare({ viteEnvironment: { name: 'ssr' } }),
		viteTsConfigPaths({	projects: ['./tsconfig.json']	}),
		tanstackStart(),
		viteReact(),
	];

	const alias: Record<string, string> = {
		'@': fileURLToPath(new URL('./src', import.meta.url)),
	};
	const external: ExternalOption = [/^@valkey\//];

	const unavailableShim = fileURLToPath(new URL('./src/shims/unavailable.ts', import.meta.url));

	if (process.env.CF == null) {
		plugins[1] = nitro({ output: { dir: 'dist' } });
		external.push(/^@libsql\//);
		alias['cloudflare:workers'] = unavailableShim;
	}
	else {
		alias['@valkey/valkey-glide'] = unavailableShim;
	}

	return {
		resolve: {
			alias,
		},
		plugins,
		server: {
			cors: false,
		},
		ssr: {
			noExternal: [
				'@adobe/react-spectrum',
				/^@react-spectrum\/.*/,
				/^@spectrum-icons\/.*/,
			],
		},
		optimizeDeps: {
			exclude: ['@valkey/valkey-glide'],
		},
		build: {
			rollupOptions: {
				external,
				output: {
					manualChunks(id) {
						if (
							/macro-.*\.css$/.test(id)
							|| /@react-spectrum\/s2\/.*\.css$/.test(id)
						) {
							return 's2-styles';
						}
						else {
							return undefined;
						}
					},
				},
			},
		},
	};
});

export default config;
