import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { anythingRoute } from "../../../src/routes/anything/index.js";

describe("Status Codes Route", () => {
	const fastify = Fastify();
	anythingRoute(fastify);

	it("should return a valid status code when provided", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/anything",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().method).toBe("GET");
		expect(response.json().url).toBe("/anything");
		expect(response.json().args).toEqual({});
		expect(response.json().data).toEqual({});
		expect(response.json().files).toEqual({});
		expect(response.json().form).toEqual({});
		expect(response.json().headers).toBeDefined();
		expect(response.json().json).toEqual({});
		expect(response.json().origin).toBeDefined();
	});

	it("should accept a binary body instead of rejecting it with 415", async () => {
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
		const response = await fastify.inject({
			method: "POST",
			url: "/anything",
			payload: png,
			headers: { "content-type": "image/png" },
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.data).toBe(png.toString("base64"));
		expect(body.form).toBe(png.toString("base64"));
		expect(body.json).toBe(png.toString("base64"));
	});
});
