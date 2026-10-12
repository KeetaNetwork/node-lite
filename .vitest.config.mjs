import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'vitest/config';

/** @type {import('vitest/config').UserConfig} */
let vitestConfig = defineConfig({
	/*
	 * Preserve symlink paths so ledger tests that are symlinks still see the
	 * symlink basename via __filename (e.g. db_memory.test.ts → db_memory).
	 */
	resolve: {
		preserveSymlinks: true
	},
	test: {
		include: ['src/**/*.test.ts'],
		exclude: [
			'**/dist/**',
			'**/node_modules/**'
		],
		environment: 'node',
		testTimeout: 120_000,
		maxWorkers: '75%'
	}
});

/*
 * Support a local .vitest.config.local.mjs file for overrides.
 * Loaded via createRequire so Vite does not statically resolve a missing file.
 */
const localConfigPath = './.vitest.config.local.mjs';
if (fs.existsSync(localConfigPath)) {
	const require = createRequire(import.meta.url);
	const localConfig = await import(pathToFileURL(require.resolve(localConfigPath)).href);
	if (typeof localConfig.vitestConfig === 'function') {
		vitestConfig = localConfig.vitestConfig(vitestConfig);
	}
}

export default vitestConfig;
