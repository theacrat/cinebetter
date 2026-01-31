import antfu from '@antfu/eslint-config';
import packageJson from 'eslint-plugin-package-json';

export default antfu({
	formatters: true,
	react: true,
	stylistic: {
		indent: 'tab',
		semi: true,
	},
	typescript: {
		tsconfigPath: 'tsconfig.json',
	},
	ignores: ['./src/generated/*', './src/routeTree.gen.ts'],
}).append(packageJson.configs.recommended);
