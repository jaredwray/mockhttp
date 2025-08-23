import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { sitemapRoute } from "../../src/routes/sitemap.js";

describe("sitemap-route", () => {
	it("should return the Redoc HTML page on GET /", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		sitemapRoute(fastify);

		const response = await fastify.inject({
			method: "GET",
			url: "/sitemap.xml",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe("text/xml");
		expect(response.payload).toContain(
			'<?xml version="1.0" encoding="UTF-8"?>',
		);
	});
});
