import { type Config } from "prettier";

const config: Config = {
	useTabs: true,
	overrides: [
		{
			files: ["**/*.jsonc", "bun.lock"],
			options: {
				trailingComma: "none",
			},
		},
	],
	plugins: ["@trivago/prettier-plugin-sort-imports"],
};

export default config;
