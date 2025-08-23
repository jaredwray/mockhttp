import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { patchRoute } from "../../../src/routes/http-methods/patch.js";

describe("PATCH /patch route", () => {
	// eslint-disable-next-line new-cap
	const fastify = Fastify();
	patchRoute(fastify);

	it("should return 200 with correct method, headers, and body", async () => {
		const response = await fastify.inject({
			method: "PATCH",
			url: "/patch",
			headers: {
				"Content-Type": "application/json",
			},
			payload: {
				key: "value",
			},
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody.method).toBe("PATCH");
		expect(responseBody.headers["content-type"]).toBe("application/json");
		expect(responseBody.body).toEqual({ key: "value" });
	});

	it("should return 200 with empty body", async () => {
		const response = await fastify.inject({
			method: "PATCH",
			url: "/patch",
			headers: {
				"Content-Type": "application/json",
			},
			payload: {},
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody.method).toBe("PATCH");
		expect(responseBody.headers["content-type"]).toBe("application/json");
		expect(responseBody.body).toEqual({});
	});

	it("should return 200 with additional properties in body", async () => {
		const response = await fastify.inject({
			method: "PATCH",
			url: "/patch",
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
		expect(responseBody.method).toBe("PATCH");
		expect(responseBody.headers["content-type"]).toBe("application/json");
		expect(responseBody.body).toEqual({ key1: "value1", key2: "value2" });
	});
});
