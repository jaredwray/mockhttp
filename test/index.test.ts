import process from "node:process";
import { afterEach, describe, expect, it } from "vitest";
import { start } from "../src/index.js";

describe("start", () => {
	afterEach(() => {
		delete process.env.AUTO_DETECT_PORT;
		delete process.env.EDGE_PROXY_TOKEN;
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

	it("should set the edge proxy token from the environment", async () => {
		process.env.PORT = "8082";
		process.env.HOST = "localhost";
		process.env.AUTO_DETECT_PORT = "false";
		process.env.EDGE_PROXY_TOKEN = "edge-secret";
		const mockHttp = await start();
		expect(mockHttp.edgeProxyToken).toBe("edge-secret");
		expect(mockHttp.port).toBe(8082);
		await mockHttp.close();
	});
});
