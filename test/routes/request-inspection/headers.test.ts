import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { headersRoute } from "../../../src/routes/request-inspection/headers.js";

describe("GET /headers", () => {
	it("should return all headers of the client request", async () => {
		const fastify = Fastify();
		headersRoute(fastify);

		const response = await fastify.inject({
			method: "GET",
			url: "/headers",
			headers: {
				"x-test-header": "test-value",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			headers: {
				"x-test-header": "test-value",
				"user-agent": "lightMyRequest",
				host: "localhost:80",
			},
		});
	});

	it("should return an empty object if no headers are present", async () => {
		const fastify = Fastify();
		headersRoute(fastify);

		const response = await fastify.inject({
			method: "GET",
			url: "/headers",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			headers: { "user-agent": "lightMyRequest", host: "localhost:80" },
		});
	});
});
