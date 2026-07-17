import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
	encodeRequestBody,
	isFormContentType,
	isJsonContentType,
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

	it("decodes structured-syntax-suffix content types (RFC 6839) as text", () => {
		expect(
			encodeRequestBody(Buffer.from('{"a":1}'), "application/ld+json"),
		).toBe('{"a":1}');
		expect(
			encodeRequestBody(Buffer.from("<a/>"), "application/vnd.api+json"),
		).toBe("<a/>");
		expect(encodeRequestBody(Buffer.from("<a/>"), "image/svg+xml")).toBe(
			"<a/>",
		);
	});

	it("does not treat a lookalike type like application/jsonp as textual", () => {
		const bytes = Buffer.from([1, 2, 3]);
		expect(encodeRequestBody(bytes, "application/jsonp")).toBe(
			bytes.toString("base64"),
		);
	});
});

describe("isJsonContentType", () => {
	it("matches application/json and structured-syntax-suffix JSON types", () => {
		expect(isJsonContentType("application/json")).toBe(true);
		expect(isJsonContentType("application/json; charset=utf-8")).toBe(true);
		expect(isJsonContentType("application/ld+json")).toBe(true);
	});

	it("does not match non-JSON or missing content types", () => {
		expect(isJsonContentType("application/xml")).toBe(false);
		expect(isJsonContentType("application/jsonp")).toBe(false);
		expect(isJsonContentType(undefined)).toBe(false);
	});
});

describe("isFormContentType", () => {
	it("matches url-encoded and multipart form bodies", () => {
		expect(isFormContentType("application/x-www-form-urlencoded")).toBe(true);
		expect(isFormContentType("multipart/form-data; boundary=----abc")).toBe(
			true,
		);
	});

	it("does not match non-form or missing content types", () => {
		expect(isFormContentType("application/json")).toBe(false);
		expect(isFormContentType(undefined)).toBe(false);
	});
});
