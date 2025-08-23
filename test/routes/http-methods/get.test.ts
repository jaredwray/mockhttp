import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { getRoute } from "../../../src/routes/http-methods/get.js";

describe("GET /get route", () => {
	// eslint-disable-next-line new-cap
	const fastify = Fastify();
	getRoute(fastify);

	it("should return method, headers, and queryParams", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/get",
			headers: {
				"x-test-header": "test-header-value",
			},
			query: {
				testParam: "test-value",
			},
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody).toEqual({
			method: "GET",
			headers: {
				"x-test-header": "test-header-value",
				"user-agent": "lightMyRequest",
				host: "localhost:80",
			},
			queryParams: { testParam: "test-value" },
		});
	});

	it("should return empty headers and queryParams if none are provided", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/get",
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody).toEqual({
			method: "GET",
			headers: { "user-agent": "lightMyRequest", host: "localhost:80" },
			queryParams: {},
		});
	});
});
