import process from "node:process";
import { mock } from "node:test";
import { describe, expect, it } from "vitest";
import { start } from "../src/index.js";

describe("start", () => {
	it("should start the server and log info", async () => {
		process.env.PORT = "8080";
		process.env.HOST = "localhost";
		const mockHttp = await start();
		expect(mockHttp.port).toBe(8080);
		expect(mockHttp.host).toBe("localhost");
		await mockHttp.close();
	});
});
