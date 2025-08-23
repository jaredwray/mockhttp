import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			reporter: ["text", "lcov", "json"],
			exclude: ["scripts/**", "dist/**", "vitest.config.ts"],
		},
	},
});
