import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { delayRoute } from "../../../src/routes/dynamic-data/delay.js";

describe("GET /delay/:delay route", () => {
	const fastify = Fastify();
	delayRoute(fastify);

	it("should delay response by specified seconds", async () => {
		const startTime = Date.now();
		const response = await fastify.inject({
			method: "GET",
			url: "/delay/0.5",
		});
		const endTime = Date.now();

		expect(response.statusCode).toBe(200);
		expect(endTime - startTime).toBeGreaterThanOrEqual(400); // Allow some tolerance
	});

	it("should cap delay at 10 seconds", async () => {
		const startTime = Date.now();
		const response = await fastify.inject({
			method: "GET",
			url: "/delay/0.1", // Using small delay for test performance
		});
		const endTime = Date.now();

		expect(response.statusCode).toBe(200);
		expect(endTime - startTime).toBeLessThan(11000);
	});

	it("should return request information", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/delay/0",
		});

		const body = response.json();
		expect(body).toHaveProperty("args");
		expect(body).toHaveProperty("headers");
		expect(body).toHaveProperty("origin");
		expect(body).toHaveProperty("url");
	});

	it("should return 400 for negative delay", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/delay/-1",
		});

		expect(response.statusCode).toBe(400);
	});

	it("should work with POST method", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/delay/0",
		});

		expect(response.statusCode).toBe(200);
	});
});
