import { afterEach, describe, expect, it, vi } from "vitest";
import { MockHttp } from "../../src/mock-http.js";

describe("GET /healthz", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("reports the in-memory bin store on the Node server", async () => {
		const mock = new MockHttp({ logging: false, rateLimit: false });
		await mock.initialize();
		const health = await mock.server.inject({ method: "GET", url: "/healthz" });
		expect(health.statusCode).toBe(200);
		expect(health.json()).toMatchObject({
			status: "ok",
			bins: {
				store: "memory",
				connected: true,
				uriPresent: false,
				scheme: null,
			},
		});
		expect(health.json().bins.latencyMs).toEqual(expect.any(Number));
		const spec = mock.server.swagger() as { paths: Record<string, unknown> };
		expect(spec.paths["/healthz"]).toBeDefined();
		await mock.close();
	});

	it("returns 503 when the memory store read fails", async () => {
		const errorLog = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const mock = new MockHttp({ logging: false, rateLimit: false });
		await mock.initialize();
		vi.spyOn(mock.bins.keyv, "get").mockRejectedValue(
			new Error("memory down mongodb://user:pass@secret-host.example/db"),
		);
		const health = await mock.server.inject({ method: "GET", url: "/healthz" });
		expect(health.statusCode).toBe(503);
		expect(health.json()).toMatchObject({
			status: "error",
			bins: {
				store: "memory",
				connected: false,
				uriPresent: false,
				scheme: null,
				error: { name: "Error" },
			},
		});
		expect(health.body).not.toContain("user:pass");
		expect(health.body).not.toContain("secret-host");
		expect(errorLog.mock.calls.join("\n")).toContain("healthz");
		await mock.close();
	});

	it("redacts an unexpected probe failure", async () => {
		const mock = new MockHttp({ logging: false, rateLimit: false });
		mock.binHealthCheck = () => {
			throw new Error("boom mongodb://user:pass@secret-host.example/db");
		};
		await mock.initialize();
		const health = await mock.server.inject({ method: "GET", url: "/healthz" });
		expect(health.statusCode).toBe(503);
		expect(health.json().bins.error.message).toBe("boom [redacted-uri]");
		expect(health.body).not.toContain("user:pass");
		expect(health.body).not.toContain("secret-host");
		await mock.close();
	});
});
