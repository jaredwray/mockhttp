import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { bytesRoute } from "../../../src/routes/dynamic-data/bytes.js";

describe("GET /bytes/:n route", () => {
	const fastify = Fastify();
	bytesRoute(fastify);

	it("should return n random bytes", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/bytes/100",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe("application/octet-stream");
		expect(response.rawPayload.length).toBe(100);
	});

	it("should return 0 bytes when n is 0", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/bytes/0",
		});

		expect(response.statusCode).toBe(200);
		expect(response.rawPayload.length).toBe(0);
	});

	it("should return same bytes with same seed", async () => {
		const response1 = await fastify.inject({
			method: "GET",
			url: "/bytes/100?seed=12345",
		});
		const response2 = await fastify.inject({
			method: "GET",
			url: "/bytes/100?seed=12345",
		});

		expect(response1.rawPayload).toEqual(response2.rawPayload);
	});

	it("should return different bytes with different seeds", async () => {
		const response1 = await fastify.inject({
			method: "GET",
			url: "/bytes/100?seed=12345",
		});
		const response2 = await fastify.inject({
			method: "GET",
			url: "/bytes/100?seed=54321",
		});

		expect(response1.rawPayload).not.toEqual(response2.rawPayload);
	});

	it("should cap bytes at 100KB", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/bytes/200000",
		});

		expect(response.statusCode).toBe(200);
		expect(response.rawPayload.length).toBe(100 * 1024);
	});

	it("should return 400 for negative n", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/bytes/-1",
		});

		expect(response.statusCode).toBe(400);
	});

	it("should return 400 for invalid seed", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/bytes/100?seed=invalid",
		});

		expect(response.statusCode).toBe(400);
	});
});
