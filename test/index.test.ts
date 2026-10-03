import process from "node:process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { start } from "../src/index.js";

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return {
		...actual,
		access(directory: Parameters<typeof actual.access>[0]) {
			// site/dist is a build artifact. Reject it so the trace catch is covered
			// whether or not that directory exists on disk.
			if (String(directory).endsWith("site/dist")) {
				return Promise.reject(new Error("missing"));
			}
			return actual.access(directory);
		},
	};
});

describe("start", () => {
	afterEach(() => {
		delete process.env.AUTO_DETECT_PORT;
	});

	it("should start the server and log info", async () => {
		process.env.PORT = "8080";
		process.env.HOST = "localhost";
		const mockHttp = await start();
		expect(mockHttp.port).toBe(8080);
		expect(mockHttp.host).toBe("localhost");
		expect(mockHttp.autoDetectPort).toBe(true);
		await mockHttp.close();
	});

	it("should keep the requested port when auto detect is disabled", async () => {
		process.env.PORT = "8081";
		process.env.HOST = "localhost";
		process.env.AUTO_DETECT_PORT = "false";
		const mockHttp = await start();
		expect(mockHttp.autoDetectPort).toBe(false);
		expect(mockHttp.port).toBe(8081);
		await mockHttp.close();
	});
});
