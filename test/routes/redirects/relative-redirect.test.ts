import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { relativeRedirectRoute } from "../../../src/routes/redirects/relative-redirect.js";

describe("Relative Redirect Route", async () => {
	const fastify = Fastify();
	await fastify.register(relativeRedirectRoute);

	it("should redirect to the target URL using an absolute URL", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/relative-redirect/3",
			headers: {
				host: "example.com",
			},
		});

		expect(response.statusCode).toBe(302);
		expect(response.headers.location).toBe("/relative-redirect/2");
		expect(response.headers["content-type"]).toBe("text/html");
		expect(response.payload).toContain("Redirecting...");
		expect(response.payload).toContain(
			'<a href="/relative-redirect/2">/relative-redirect/2</a>',
		);
	});

	it("should redirect to the target URL using an absolute URL with a custom host", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/relative-redirect/3",
			headers: {
				host: "example.net",
			},
		});

		expect(response.statusCode).toBe(302);
		expect(response.headers.location).toBe("/relative-redirect/2");
		expect(response.headers["content-type"]).toBe("text/html");
		expect(response.payload).toContain("Redirecting...");
		expect(response.payload).toContain("/relative-redirect/2");
	});
});
