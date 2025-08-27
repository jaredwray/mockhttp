import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { responseHeadersRoutes } from "../../../src/routes/response-inspection/index.js";

describe("Response Headers Routes", () => {
	const fastify = Fastify();

	beforeAll(async () => {
		await fastify.register(responseHeadersRoutes);
	});

	afterAll(async () => {
		await fastify.close();
	});

	it("should add query string parameters as response headers for GET requests", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/response-headers?header1=value1&header2=value2",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers.header1).toBe("value1");
		expect(response.headers.header2).toBe("value2");
		expect(response.json()).toEqual({ header1: "value1", header2: "value2" });
	});

	it("should add query string and body parameters as response headers for POST requests", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/response-headers?queryParam=value",
			payload: {},
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers.queryparam).toBe("value");
		expect(response.json()).toEqual({ queryParam: "value" });
	});

	it("should handle empty query strings for GET requests", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/response-headers",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({});
	});

	it("should handle empty query strings and body for POST requests", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/response-headers",
			payload: {
				foo: "bar",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ foo: "bar" });
	});
});
