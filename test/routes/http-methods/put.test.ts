import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { putRoute } from "../../../src/routes/http-methods/put.js";

describe("PUT /put route", () => {
	// eslint-disable-next-line new-cap
	const fastify = Fastify();
	putRoute(fastify);

	it("should return request information for a valid PUT request", async () => {
		const response = await fastify.inject({
			method: "PUT",
			url: "/put",
			headers: {
				"Content-Type": "application/json",
			},
			payload: {
				key: "value",
			},
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody).toEqual({
			method: "PUT",

			headers: expect.objectContaining({
				"content-type": "application/json",
			}),
			body: {
				key: "value",
			},
		});
	});

	it("should handle PUT request with additional properties in the body", async () => {
		const response = await fastify.inject({
			method: "PUT",
			url: "/put",
			headers: {
				"Content-Type": "application/json",
			},
			payload: {
				key1: "value1",
				key2: "value2",
			},
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody).toEqual({
			method: "PUT",

			headers: expect.objectContaining({
				"content-type": "application/json",
			}),
			body: {
				key1: "value1",
				key2: "value2",
			},
		});
	});

	it("should return 400 for invalid PUT request body", async () => {
		const response = await fastify.inject({
			method: "PUT",
			url: "/put",
			headers: {
				"Content-Type": "application/json",
			},
			payload: "invalid body",
		});

		expect(response.statusCode).toBe(400);
	});
});
