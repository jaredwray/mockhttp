import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { postRoute } from "../../../src/routes/http-methods/post.js";

describe("POST /post route", async () => {
	// eslint-disable-next-line new-cap
	const fastify = Fastify();
	await fastify.register(postRoute);

	it("should return 200 with correct response structure", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/post",
			payload: {
				key: "value",
			},
			headers: {
				"Content-Type": "application/json",
			},
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody).toHaveProperty("method", "POST");
		expect(responseBody).toHaveProperty("headers");
		expect(responseBody).toHaveProperty("body");
		expect(responseBody.body).toEqual({ key: "value" });
	});

	it("should handle additional properties in the body", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/post",
			payload: {
				key1: "value1",
				key2: "value2",
			},
			headers: {
				"Content-Type": "application/json",
			},
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody.body).toEqual({ key1: "value1", key2: "value2" });
	});

	it("should return headers in the response", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/post",
			payload: {
				key: "value",
			},
			headers: {
				"Content-Type": "application/json",
				"Custom-Header": "CustomValue",
			},
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody.headers).toHaveProperty(
			"content-type",
			"application/json",
		);
		expect(responseBody.headers).toHaveProperty("custom-header", "CustomValue");
	});
});
