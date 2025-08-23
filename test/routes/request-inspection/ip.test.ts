import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { ipRoute } from "../../../src/routes/request-inspection/ip.js";

describe("IP Route", async () => {
	// eslint-disable-next-line new-cap
	const fastify = Fastify();
	await fastify.register(ipRoute);

	it("should return the IP address from cf-connecting-ip header", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/ip",
			headers: {
				"cf-connecting-ip": "203.0.113.1",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ ip: "203.0.113.1" });
	});

	it("should return the IP address from x-forwarded-for header", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/ip",
			headers: {
				"x-forwarded-for": "198.51.100.1, 198.51.100.2",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ ip: "198.51.100.1" });
	});

	it("should return the remote IP address if no proxy headers are present", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/ip",
			remoteAddress: "192.0.2.1",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ ip: "192.0.2.1" });
	});

	it("should prioritize cf-connecting-ip over x-forwarded-for", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/ip",
			headers: {
				"cf-connecting-ip": "203.0.113.1",
				"x-forwarded-for": "198.51.100.1, 198.51.100.2",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ ip: "203.0.113.1" });
	});
});
