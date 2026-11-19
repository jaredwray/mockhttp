import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockHttp } from "../../../src/mock-http.js";
import { responseHeadersRoutes } from "../../../src/routes/response-inspection/index.js";

const FORBIDDEN_HEADER_NAMES = [
	"trailer",
	"transfer-encoding",
	"content-length",
	"connection",
	"keep-alive",
	"upgrade",
	"te",
	"proxy-connection",
	"host",
	":path",
	":method",
	":status",
	":authority",
	":scheme",
];

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

	it("returns 400 for invalid JSON", async () => {
		const response = await fastify.inject({
			method: "POST",
			url: "/response-headers",
			headers: { "content-type": "application/json" },
			payload: "{",
		});

		expect(response.statusCode).toBe(400);
		expect(response.json().code).toBe("FST_ERR_CTP_INVALID_JSON_BODY");
	});

	it("should treat a POST with no body as an empty header set", async () => {
		const response = await fastify.inject({
			method: "POST",
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

describe("Response header name guard", () => {
	const mock = new MockHttp({ logging: false, rateLimit: false });

	beforeAll(async () => {
		await mock.start();
	});

	afterAll(async () => {
		await mock.close();
	});

	it("returns 400 for each forbidden name and keeps serving", async () => {
		expect(mock.helmet).toBe(true);

		for (const name of FORBIDDEN_HEADER_NAMES) {
			const get = await mock.server.inject({
				method: "GET",
				url: `/response-headers?${encodeURIComponent(name)}=x`,
			});
			expect(get.statusCode, `GET ${name}`).toBe(400);
			expect(get.json()).toEqual({
				error: `The header name "${name}" is not permitted.`,
			});

			const post = await mock.server.inject({
				method: "POST",
				url: "/response-headers",
				payload: { [name]: "x" },
			});
			expect(post.statusCode, `POST ${name}`).toBe(400);
			expect(post.json()).toEqual({
				error: `The header name "${name}" is not permitted.`,
			});
		}

		for (const name of ["Trailer", "KEEP-ALIVE", "Transfer-Encoding"]) {
			const response = await mock.server.inject({
				method: "GET",
				url: `/response-headers?${encodeURIComponent(name)}=x`,
			});
			expect(response.statusCode, name).toBe(400);
			expect(response.json().error).toBe(
				`The header name "${name}" is not permitted.`,
			);
		}

		const spaced = await mock.server.inject({
			method: "GET",
			url: "/response-headers?bad%20name=x",
		});
		expect(spaced.statusCode).toBe(400);
		expect(spaced.json()).toEqual({
			error: 'The header name "bad name" is not permitted.',
		});

		const newline = await mock.server.inject({
			method: "GET",
			url: "/response-headers?x-custom=a%0Ab",
		});
		expect(newline.statusCode).toBe(400);
		expect(newline.json().error).toBe(
			'The header name "x-custom" is not permitted.',
		);

		const mixed = await mock.server.inject({
			method: "GET",
			url: "/response-headers?x-ok=1&trailer=x",
		});
		expect(mixed.statusCode).toBe(400);
		expect(mixed.headers["x-ok"]).toBeUndefined();
		expect(mixed.headers.trailer).toBeUndefined();

		const length = await mock.server.inject({
			method: "POST",
			url: "/response-headers?x-ok=1",
			payload: { "content-length": "99999" },
		});
		expect(length.statusCode).toBe(400);
		expect(length.headers["content-length"]).not.toBe("99999");
		expect(length.headers["x-ok"]).toBeUndefined();

		const ok = await mock.server.inject({
			method: "GET",
			url: "/response-headers?x-ok=yes",
		});
		expect(ok.statusCode).toBe(200);
		expect(ok.headers["x-ok"]).toBe("yes");
		expect(ok.json()).toEqual({ "x-ok": "yes" });

		const stillUp = await mock.server.inject({ method: "GET", url: "/get" });
		expect(stillUp.statusCode).toBe(200);
	});

	it("echoes a prototype key and drops it when a later name is rejected", async () => {
		const protoName = ["__", "proto__"].join("");
		const echoed = await mock.server.inject({
			method: "GET",
			url: `/response-headers?${encodeURIComponent(protoName)}=safe`,
		});
		expect(echoed.statusCode).toBe(200);
		const echoedBody = JSON.parse(echoed.body) as Record<string, unknown>;
		expect(Object.hasOwn(echoedBody, protoName)).toBe(true);
		expect(Object.getOwnPropertyDescriptor(echoedBody, protoName)?.value).toBe(
			"safe",
		);

		const rejected = await mock.server.inject({
			method: "GET",
			url: `/response-headers?${encodeURIComponent(protoName)}=safe&trailer=x`,
		});
		expect(rejected.statusCode).toBe(400);
		expect(rejected.json()).toEqual({
			error: 'The header name "trailer" is not permitted.',
		});
		const rejectedHeaders = (
			rejected.raw as {
				res: { getHeaders: () => Record<string, unknown> };
			}
		).res.getHeaders();
		expect(Object.hasOwn(rejectedHeaders, protoName)).toBe(false);
	});
});
