import keetanetworkConfig from '@keetanetwork/eslint-config-typescript';

export default [
	{
		ignores: [
			'**/*',
			'!src/**',
			'!package.json'
		]
	},
	{
		ignores: [
			'src/**/*.FROM_NODE.test.ts',
			'src/**/*.FROM_NODE.ts',
			'src/lib/utils/external-keys/**',
			'src/lib/log/target_https.js',
			'src/lib/log/target_gcp.js',
			'src/lib/log/**/*.d.ts',
			/*
			 * Webpack-extracted copies. Re-sync from the client bundle rather
			 * than restyle these files in-place.
			 */
			'src/lib/ledger/effects.ts',
			'src/lib/ledger/types.ts',
			'src/lib/p2p.ts',
			'src/lib/utils/ed2curve.ts',
			'src/lib/vote.ts'
		]
	},
	...keetanetworkConfig,
	{
		languageOptions: {
			parserOptions: {
				project: ['tsconfig.json']
			}
		}
	},
	{
		files: ['**/*.ts'],
		rules: {
			/*
			 * Path-compatible client mirror: each module uses AssertNever over
			 * `typeof import(...)` and Impl→client casts. Stub constructors exist
			 * only to match the client surface. Those patterns trip these
			 * type-aware rules even when the surface is honest.
			 */
			'@typescript-eslint/consistent-type-assertions': 'off',
			'@typescript-eslint/consistent-type-imports': 'off',
			'@typescript-eslint/no-duplicate-type-constituents': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-redundant-type-constituents': 'off',
			'@typescript-eslint/no-unnecessary-type-assertion': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-extraneous-class': 'off',
			'@typescript-eslint/no-unused-vars': ['error', {
				args: 'after-used',
				argsIgnorePattern: '^_ignored',
				varsIgnorePattern: '^_Assert'
			}],
			'@typescript-eslint/no-useless-constructor': 'off',
			'@typescript-eslint/unified-signatures': 'off'
		}
	}
];
