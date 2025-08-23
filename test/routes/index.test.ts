import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { indexRoute } from "../../src/routes/index.js"; // Adjust the path as necessary

describe("index-route", () => {
	it("should return the Redoc HTML page on GET /", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		indexRoute(fastify);

		const response = await fastify.inject({
			method: "GET",
			url: "/",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe("text/html");
		expect(response.payload).toContain("<!doctype html>");
		expect(response.payload).toContain("<title>{ mockhttp }</title>");
		expect(response.payload).toContain(
			'<img src="/logo.svg" alt="{ mockhttp }" />',
		);
	});
});
