import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { base64Route } from "../../../src/routes/dynamic-data/base64.js";

describe("GET /base64/:value route", () => {
	const fastify = Fastify();
	base64Route(fastify);

	it("should decode standard base64", async () => {
		// "Hello World" in base64
		const response = await fastify.inject({
			method: "GET",
			url: "/base64/SGVsbG8gV29ybGQ=",
		});

		expect(response.statusCode).toBe(200);
		expect(response.payload).toBe("Hello World");
	});

	it("should decode base64url encoding", async () => {
		// Test base64url characters
		const response = await fastify.inject({
			method: "GET",
			url: "/base64/SFRUUEJJTiBpcyBhd2Vzb21l",
		});

		expect(response.statusCode).toBe(200);
		expect(response.payload).toBe("HTTPBIN is awesome");
	});

	it("should handle special characters in base64", async () => {
		// "test+value/=" encoded
		const response = await fastify.inject({
			method: "GET",
			url: "/base64/dGVzdCt2YWx1ZS89",
		});

		expect(response.statusCode).toBe(200);
		expect(response.payload).toBe("test+value/=");
	});

	it("should return proper content-type header", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/base64/SGVsbG8=",
		});

		expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
	});

	it("should return 400 for invalid base64 data", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/base64/!!!invalid!!!",
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({ error: "Incorrect Base64 data" });
	});
});
