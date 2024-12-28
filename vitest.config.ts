import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			exclude: [
				'scripts/**',
				'dist/**',
				'vitest.config.ts',
			],
		},
	},
});
