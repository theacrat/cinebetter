import { cloudflare } from "@cloudflare/vite-plugin";
import devServer from "@hono/vite-dev-server";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import macros from "unplugin-parcel-macros";
import { defineConfig } from "vite";

export default defineConfig(({ mode, command }) => {
	const plugins = [macros.vite(), react()];

	if (mode === "cf") {
		plugins.push(cloudflare());
	} else if (command === "serve") {
		plugins.push(
			devServer({
				entry: "src/worker/entry-bun.ts",
				exclude: [/^(?!.*\.json$).*$/],
			}),
		);
	}

	return {
		server: {
			cors: false,
		},
		plugins: plugins,
		resolve: {
			alias: {
				"cross-fetch": path.resolve(
					__dirname,
					"./src/worker/shims/fetch-shim.ts",
				),
			},
		},
		build: {
			outDir: mode !== "cf" ? "dist/client" : undefined,
			rollupOptions: {
				output: {
					manualChunks(id) {
						if (
							/macro-(.*)\.css$/.test(id) ||
							/@react-spectrum\/s2\/.*\.css$/.test(id)
						) {
							return "s2-styles";
						}
					},
				},
			},
		},
	};
});
