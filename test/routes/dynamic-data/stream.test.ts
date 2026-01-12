import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { streamRoute } from "../../../src/routes/dynamic-data/stream.js";

describe("GET /stream/:n route", () => {
	const fastify = Fastify();
	streamRoute(fastify);

	it("should stream n JSON responses", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/stream/3",
		});

		expect(response.statusCode).toBe(200);

		const lines = response.payload.trim().split("\n");
		expect(lines.length).toBe(3);

		for (let i = 0; i < lines.length; i++) {
			const data = JSON.parse(lines[i]);
			expect(data.id).toBe(i);
			expect(data).toHaveProperty("headers");
			expect(data).toHaveProperty("origin");
			expect(data).toHaveProperty("url");
		}
	});

	it("should cap at 100 lines", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/stream/150",
		});

		expect(response.statusCode).toBe(200);

		const lines = response.payload.trim().split("\n");
		expect(lines.length).toBe(100);
	});

	it("should return 0 lines when n is 0", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/stream/0",
		});

		expect(response.statusCode).toBe(200);
		expect(response.payload).toBe("");
	});

	it("should return 400 for negative n", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/stream/-1",
		});

		expect(response.statusCode).toBe(400);
	});

	it("should include query args in response", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/stream/1?foo=bar",
		});

		const data = JSON.parse(response.payload.trim());
		expect(data.args).toEqual({ foo: "bar" });
	});
});
