import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
	documents: ["src/**/*.ts", "!src/generated/**/*"],
	generates: {
		"./src/generated/gql/": {
			config: {
				avoidOptionals: {
					defaultValue: true,
					field: true,
					inputValue: false,
					object: true,
				},
				enumsAsConst: true,
				extractAllFieldsToTypes: true,
				immutableTypes: true,
				useTypeImports: true,
			},
			preset: "client",
			presetConfig: {
				fragmentMasking: false,
			},
		},
	},
	ignoreNoDocuments: true,
	schema: "./schemas/schema.graphql",
};

export default config;
