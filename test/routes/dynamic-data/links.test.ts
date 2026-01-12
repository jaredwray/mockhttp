import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { linksRoute } from "../../../src/routes/dynamic-data/links.js";

describe("GET /links/:n/:offset route", () => {
	const fastify = Fastify();
	linksRoute(fastify);

	it("should generate n links", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/links/5",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");

		// Check that it contains 4 links (current page is just text)
		const linkCount = (response.payload.match(/<a href/g) || []).length;
		expect(linkCount).toBe(4); // 5 total pages, 4 links (excluding current)
	});

	it("should highlight current page at offset", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/links/5/2",
		});

		expect(response.statusCode).toBe(200);
		// Page 2 should not be a link
		expect(response.payload).toContain("2 ");
		expect(response.payload).not.toContain('href="/links/5/2"');
	});

	it("should cap at 200 links", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/links/300",
		});

		expect(response.statusCode).toBe(200);

		const linkCount = (response.payload.match(/<a href/g) || []).length;
		expect(linkCount).toBe(199); // 200 total pages, 199 links
	});

	it("should return 400 for negative n", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/links/-1",
		});

		expect(response.statusCode).toBe(400);
	});

	it("should return 400 for negative offset", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/links/5/-1",
		});

		expect(response.statusCode).toBe(400);
	});

	it("should default offset to 0", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/links/3",
		});

		expect(response.statusCode).toBe(200);
		// Page 0 should not be a link
		expect(response.payload).toContain("0 ");
		expect(response.payload).not.toContain('href="/links/3/0"');
	});

	it("should generate valid link URLs", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/links/3/0",
		});

		expect(response.statusCode).toBe(200);
		expect(response.payload).toContain('href="/links/3/1"');
		expect(response.payload).toContain('href="/links/3/2"');
	});
});
