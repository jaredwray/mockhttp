import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { deleteRoute } from "../../../src/routes/http-methods/delete.js";

describe("DELETE /delete", () => {
	const fastify = Fastify();
	deleteRoute(fastify);

	it("should return 200 with correct method, headers, and body", async () => {
		const response = await fastify.inject({
			method: "DELETE",
			url: "/delete",
			headers: {
				"Content-Type": "application/json",
			},
			payload: {
				key: "value",
			},
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody.method).toBe("DELETE");
		expect(responseBody.headers["content-type"]).toBe("application/json");
		expect(responseBody.body).toEqual({ key: "value" });
	});

	it("should handle empty body", async () => {
		const response = await fastify.inject({
			method: "DELETE",
			url: "/delete",
			headers: {
				"Content-Type": "application/json",
			},
			payload: {},
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody.method).toBe("DELETE");
		expect(responseBody.headers["content-type"]).toBe("application/json");
		expect(responseBody.body).toEqual({});
	});

	it("should handle additional properties in headers", async () => {
		const response = await fastify.inject({
			method: "DELETE",
			url: "/delete",
			headers: {
				"Content-Type": "application/json",
				"X-Custom-Header": "custom-value",
			},
			payload: {
				key: "value",
			},
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody.method).toBe("DELETE");
		expect(responseBody.headers["content-type"]).toBe("application/json");
		expect(responseBody.headers["x-custom-header"]).toBe("custom-value");
		expect(responseBody.body).toEqual({ key: "value" });
	});

	it("should handle string body", async () => {
		const response = await fastify.inject({
			method: "DELETE",
			url: "/delete",
			headers: {
				"Content-Type": "text/plain",
			},
			payload: "This is a plain text body",
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody.method).toBe("DELETE");
		expect(responseBody.headers["content-type"]).toBe("text/plain");
		expect(responseBody.body).toBe("This is a plain text body");
	});
});
