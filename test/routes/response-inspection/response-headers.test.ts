import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { responseHeadersRoutes } from "../../../src/routes/response-inspection/index.js";

describe("Response Headers Routes", () => {
	const fastify = Fastify();

	beforeAll(async () => {
		await fastify.register(responseHeadersRoutes);
	});

	afterAll(async () => {
		await fastify.close();
	});

	it("should add query string parameters as response headers for GET requests", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/response-headers?header1=value1&header2=value2",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers.header1).toBe("value1");
		expect(response.headers.header2).toBe("value2");
		expect(response.json()).toEqual({ header1: "value1", header2: "value2" });
	});

	it("should add query string and body parameters as response headers for POST requests", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/response-headers?queryParam=value",
			payload: {},
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers.queryparam).toBe("value");
		expect(response.json()).toEqual({ queryParam: "value" });
	});

	it("should handle empty query strings for GET requests", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/response-headers",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({});
	});

	it("should handle empty query strings and body for POST requests", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/response-headers",
			payload: {
				foo: "bar",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ foo: "bar" });
	});

	// Node.js throws in writeHead for "trailer" on HTTP/1.1 and for the
	// connection headers on HTTP/2. The error stops the server process.
	const rejectedHeaderNames = [
		"trailer",
		"Trailer",
		"transfer-encoding",
		"connection",
		"keep-alive",
		"proxy-connection",
		"te",
		"upgrade",
		"http2-settings",
		":status",
		"a b",
	];

	it.each(rejectedHeaderNames)(
		"should reject the header name %j for GET requests",
		async (name) => {
			const response = await fastify.inject({
				method: "GET",
				url: "/response-headers",
				query: { accepted: "1", [name]: "x" },
			});

			expect(response.statusCode).toBe(400);
			expect(response.json()).toEqual({
				error: `The header name "${name}" is not permitted.`,
			});
			expect(response.headers.accepted).toBeUndefined();
			expect(response.headers[name.toLowerCase()]).not.toBe("x");
		},
	);

	it("should reject a header name in the query string for POST requests", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/response-headers?trailer=x",
			payload: { accepted: "1" },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: 'The header name "trailer" is not permitted.',
		});
		expect(response.headers.accepted).toBeUndefined();
		expect(response.headers.trailer).toBeUndefined();
	});

	it("should reject a header name in the body for POST requests", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/response-headers?accepted=1",
			payload: { trailer: "x" },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: 'The header name "trailer" is not permitted.',
		});
		expect(response.headers.accepted).toBeUndefined();
		expect(response.headers.trailer).toBeUndefined();
	});

	it("should escape a rejected header name in the error", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/response-headers",
			query: { "<b>": "x" },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: 'The header name "&lt;b&gt;" is not permitted.',
		});
	});
});
