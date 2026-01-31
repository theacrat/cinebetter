import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
	schema: './schemas/schema.graphql',
	documents: ['src/**/*.ts', '!src/generated/**/*'],
	ignoreNoDocuments: true,
	generates: {
		'./src/generated/gql/': {
			preset: 'client',
			presetConfig: {
				fragmentMasking: false,
			},
			config: {
				enumsAsConst: true,
				useTypeImports: true,
			},
		},
	},
};

export default config;
