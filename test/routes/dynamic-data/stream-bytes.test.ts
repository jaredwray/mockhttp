import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { streamBytesRoute } from "../../../src/routes/dynamic-data/stream-bytes.js";

describe("GET /stream-bytes/:n route", () => {
	const fastify = Fastify();
	streamBytesRoute(fastify);

	it("should stream n random bytes", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/stream-bytes/100",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe("application/octet-stream");
		expect(response.rawPayload.length).toBe(100);
	});

	it("should return same bytes with same seed", async () => {
		const response1 = await fastify.inject({
			method: "GET",
			url: "/stream-bytes/100?seed=12345",
		});
		const response2 = await fastify.inject({
			method: "GET",
			url: "/stream-bytes/100?seed=12345",
		});

		expect(response1.rawPayload).toEqual(response2.rawPayload);
	});

	it("should cap bytes at 100KB", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/stream-bytes/200000",
		});

		expect(response.statusCode).toBe(200);
		expect(response.rawPayload.length).toBe(100 * 1024);
	});

	it("should return 400 for negative n", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/stream-bytes/-1",
		});

		expect(response.statusCode).toBe(400);
	});

	it("should return 400 for invalid chunk_size", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/stream-bytes/100?chunk_size=0",
		});

		expect(response.statusCode).toBe(400);
	});

	it("should return 400 for invalid seed", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/stream-bytes/100?seed=notanumber",
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({ error: "seed must be an integer" });
	});
});
