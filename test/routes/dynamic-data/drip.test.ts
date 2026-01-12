import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { dripRoute } from "../../../src/routes/dynamic-data/drip.js";

describe("GET /drip route", () => {
	const fastify = Fastify();
	dripRoute(fastify);

	it("should drip bytes over duration", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/drip?numbytes=5&duration=0.1&delay=0",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe("application/octet-stream");
		expect(response.rawPayload.length).toBe(5);
		expect(response.payload).toBe("*****");
	});

	it("should use default values", async () => {
		const startTime = Date.now();
		const response = await fastify.inject({
			method: "GET",
			url: "/drip?duration=0&delay=0",
		});
		const endTime = Date.now();

		expect(response.statusCode).toBe(200);
		expect(response.rawPayload.length).toBe(10); // Default numbytes
		// Should be quick with 0 duration and 0 delay
		expect(endTime - startTime).toBeLessThan(1000);
	});

	it("should return custom status code", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/drip?code=201&duration=0&delay=0&numbytes=1",
		});

		expect(response.statusCode).toBe(201);
	});

	it("should return 400 for invalid numbytes", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/drip?numbytes=-1&duration=0&delay=0",
		});

		expect(response.statusCode).toBe(400);
	});

	it("should return 400 for invalid code", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/drip?code=999&duration=0&delay=0",
		});

		expect(response.statusCode).toBe(400);
	});

	it("should return 400 for invalid duration", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/drip?duration=-1&delay=0",
		});

		expect(response.statusCode).toBe(400);
	});

	it("should handle zero bytes", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/drip?numbytes=0&duration=0&delay=0",
		});

		expect(response.statusCode).toBe(200);
		expect(response.rawPayload.length).toBe(0);
	});

	it("should return 400 for invalid delay", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/drip?delay=-1&duration=0",
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: "delay must be a non-negative number",
		});
	});

	it("should wait for initial delay", async () => {
		const startTime = Date.now();
		const response = await fastify.inject({
			method: "GET",
			url: "/drip?delay=0.1&duration=0&numbytes=1",
		});
		const endTime = Date.now();

		expect(response.statusCode).toBe(200);
		expect(endTime - startTime).toBeGreaterThanOrEqual(80); // Allow some tolerance
	});
});
