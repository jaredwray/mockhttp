import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { absoluteRedirectRoute } from "../../../src/routes/redirects/absolute-redirect.js";

describe("Absolute Redirect Route", async () => {
	const fastify = Fastify();
	await fastify.register(absoluteRedirectRoute);

	it("should redirect to the target URL using an absolute URL", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/absolute-redirect/3",
			headers: {
				host: "example.com",
			},
		});

		expect(response.statusCode).toBe(302);
		expect(response.headers.location).toBe(
			"http://example.com/absolute-redirect/2",
		);
		expect(response.headers["content-type"]).toBe("text/html");
		expect(response.payload).toContain("Redirecting...");
		expect(response.payload).toContain(
			'<a href="http://example.com/absolute-redirect/2">http://example.com/absolute-redirect/2</a>',
		);
	});

	it("should redirect to the target URL using an absolute URL with a custom host", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/absolute-redirect/3",
			headers: {
				host: "example.net",
			},
		});

		expect(response.statusCode).toBe(302);
		expect(response.headers.location).toBe(
			"http://example.net/absolute-redirect/2",
		);
		expect(response.headers["content-type"]).toBe("text/html");
		expect(response.payload).toContain("Redirecting...");
		expect(response.payload).toContain(
			'<a href="http://example.net/absolute-redirect/2">http://example.net/absolute-redirect/2</a>',
		);
	});
});
