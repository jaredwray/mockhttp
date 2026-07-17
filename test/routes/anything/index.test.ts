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
		// `data` always carries the encoded body, but a binary payload isn't a
		// form or a JSON body, so `form`/`json` must not echo it too.
		expect(body.data).toBe(png.toString("base64"));
		expect(body.form).toEqual({});
		expect(body.json).toEqual({});
	});

	it("should only populate `form` for a form-urlencoded body", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/anything",
			payload: "a=1&b=two",
			headers: { "content-type": "application/x-www-form-urlencoded" },
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		// This server doesn't register a dedicated application/x-www-form-urlencoded
		// parser (that's a separate, independent change), so the raw-body
		// fallback parser here decodes it as text rather than an object - but
		// it must still land under `form`, not `json`.
		expect(body.form).toBe("a=1&b=two");
		expect(body.json).toEqual({});
	});

	it("should only populate `json` for a JSON body", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/anything",
			payload: { a: 1 },
			headers: { "content-type": "application/json" },
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.json).toEqual({ a: 1 });
		expect(body.form).toEqual({});
	});
});
