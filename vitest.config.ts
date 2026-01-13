import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			reporter: ["text", "lcov", "json"],
			exclude: [
				"scripts/**", 
				"dist/**",
				"*.json",
				"src/routes/**/index.ts",
				"vitest.config.ts"
			],
		},
	},
});
