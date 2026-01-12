import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { rangeRoute } from "../../../src/routes/dynamic-data/range.js";

describe("GET /range/:numbytes route", () => {
	const fastify = Fastify();
	rangeRoute(fastify);

	it("should return n bytes without Range header", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/range/100",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe("application/octet-stream");
		expect(response.headers["accept-ranges"]).toBe("bytes");
		expect(response.rawPayload.length).toBe(100);
	});

	it("should return partial content with single Range header", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/range/100",
			headers: {
				Range: "bytes=0-9",
			},
		});

		expect(response.statusCode).toBe(206);
		expect(response.headers["content-range"]).toBe("bytes 0-9/100");
		expect(response.rawPayload.length).toBe(10);
	});

	it("should return multipart content with multiple Range headers", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/range/100",
			headers: {
				Range: "bytes=0-9,20-29",
			},
		});

		expect(response.statusCode).toBe(206);
		expect(response.headers["content-type"]).toContain("multipart/byteranges");
	});

	it("should return 416 for unsatisfiable range", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/range/100",
			headers: {
				Range: "bytes=200-300",
			},
		});

		expect(response.statusCode).toBe(416);
		expect(response.headers["content-range"]).toBe("bytes */100");
	});

	it("should handle suffix range", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/range/100",
			headers: {
				Range: "bytes=-10",
			},
		});

		expect(response.statusCode).toBe(206);
		expect(response.rawPayload.length).toBe(10);
	});

	it("should handle open-ended range", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/range/100",
			headers: {
				Range: "bytes=90-",
			},
		});

		expect(response.statusCode).toBe(206);
		expect(response.rawPayload.length).toBe(10);
	});

	it("should cap bytes at 100KB", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/range/200000",
		});

		expect(response.statusCode).toBe(200);
		expect(response.rawPayload.length).toBe(100 * 1024);
	});

	it("should return 400 for negative numbytes", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/range/-1",
		});

		expect(response.statusCode).toBe(400);
	});

	it("should return deterministic bytes (alphabet pattern)", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/range/26",
		});

		expect(response.payload).toBe("abcdefghijklmnopqrstuvwxyz");
	});
});
