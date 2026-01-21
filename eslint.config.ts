import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import packageJson from "eslint-plugin-package-json";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import { fileURLToPath, URL } from "node:url";
import tseslint from "typescript-eslint";

export default defineConfig([
	globalIgnores(["worker-configuration.d.ts"]),
	includeIgnoreFile(fileURLToPath(new URL(".gitignore", import.meta.url))),
	js.configs.recommended,
	tseslint.configs.recommended,
	reactHooks.configs.flat.recommended,
	reactRefresh.configs.vite,
	eslintConfigPrettier,
	{
		languageOptions: {
			globals: globals.browser,
		},
	},
	packageJson.configs.recommended,
	packageJson.configs.stylistic,
]);
