import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { bearerAuthRoute } from "../../../src/routes/auth/bearer.js";

describe("GET /bearer", () => {
	it("401 when required and missing", async () => {
		const fastify = Fastify();
		bearerAuthRoute(fastify);
		const response = await fastify.inject({ method: "GET", url: "/bearer" });
		expect(response.statusCode).toBe(401);
	});

	it("200 when token provided", async () => {
		const fastify = Fastify();
		bearerAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/bearer",
			headers: { authorization: "Bearer token123" },
		});
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ authenticated: true, token: "token123" });
	});

	it("200 when not required and missing", async () => {
		const fastify = Fastify();
		bearerAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/bearer?required=false",
		});
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ authenticated: false, token: "" });
	});

	it("401 with wrong scheme in Authorization", async () => {
		const fastify = Fastify();
		bearerAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/bearer",
			headers: { authorization: "Basic something" },
		});
		expect(response.statusCode).toBe(401);
	});

	it("200 when mixed-case bearer scheme with token", async () => {
		const fastify = Fastify();
		bearerAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/bearer",
			headers: { authorization: "BeArEr tok" },
		});
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ authenticated: true, token: "tok" });
	});

	it("401 when required=true explicitly and missing", async () => {
		const fastify = Fastify();
		bearerAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/bearer?required=true",
		});
		expect(response.statusCode).toBe(401);
	});
});
