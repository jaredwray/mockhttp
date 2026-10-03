import process from "node:process";
import { afterEach, describe, expect, it } from "vitest";
import { start } from "../src/index.js";

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
