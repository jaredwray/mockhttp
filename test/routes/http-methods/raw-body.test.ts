import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
	encodeRequestBody,
	registerRawBodyFallbackParser,
} from "../../../src/routes/http-methods/raw-body.js";

describe("registerRawBodyFallbackParser", () => {
	it("captures a body whose content type Fastify doesn't otherwise handle as a raw Buffer", async () => {
		const fastify = Fastify();
		registerRawBodyFallbackParser(fastify);
		fastify.post("/echo", async (request) => {
			expect(Buffer.isBuffer(request.body)).toBe(true);
			return { length: (request.body as Buffer).length };
		});

		const response = await fastify.inject({
			method: "POST",
			url: "/echo",
			payload: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
			headers: { "content-type": "application/octet-stream" },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ length: 4 });

		await fastify.close();
	});

	it("does not change how application/json bodies are already parsed", async () => {
		const fastify = Fastify();
		registerRawBodyFallbackParser(fastify);
		fastify.post("/echo", async (request) => request.body);

		const response = await fastify.inject({
			method: "POST",
			url: "/echo",
			payload: { a: 1 },
			headers: { "content-type": "application/json" },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ a: 1 });

		await fastify.close();
	});
});

describe("encodeRequestBody", () => {
	it("passes non-Buffer bodies through unchanged", () => {
		expect(encodeRequestBody({ a: 1 }, "application/json")).toEqual({ a: 1 });
		expect(encodeRequestBody("hello", "text/plain")).toBe("hello");
		expect(encodeRequestBody(undefined, undefined)).toBeUndefined();
		expect(encodeRequestBody(null, undefined)).toBeNull();
	});

	it("decodes a Buffer as utf8 text for a textual content type", () => {
		const body = Buffer.from("<a>hi</a>", "utf8");
		expect(encodeRequestBody(body, "application/xml")).toBe("<a>hi</a>");
	});

	it("base64-encodes a Buffer for a binary content type", () => {
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
		expect(encodeRequestBody(png, "image/png")).toBe(png.toString("base64"));
	});

	it("base64-encodes a Buffer when the content type is missing", () => {
		const bytes = Buffer.from([1, 2, 3]);
		expect(encodeRequestBody(bytes, undefined)).toBe(bytes.toString("base64"));
	});

	it("returns an empty string for an empty Buffer", () => {
		expect(encodeRequestBody(Buffer.alloc(0), "application/octet-stream")).toBe(
			"",
		);
	});
});
