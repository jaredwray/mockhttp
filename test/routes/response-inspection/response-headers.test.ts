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
				error: "invalid_header_name",
				header: name,
			});

			const post = await mock.server.inject({
				method: "POST",
				url: "/response-headers",
				payload: { [name]: "x" },
			});
			expect(post.statusCode, `POST ${name}`).toBe(400);
			expect(post.json()).toEqual({
				error: "invalid_header_name",
				header: name,
			});
		}

		for (const name of ["Trailer", "KEEP-ALIVE", "Transfer-Encoding"]) {
			const response = await mock.server.inject({
				method: "GET",
				url: `/response-headers?${encodeURIComponent(name)}=x`,
			});
			expect(response.statusCode, name).toBe(400);
			expect(response.json().error).toBe("invalid_header_name");
		}

		const spaced = await mock.server.inject({
			method: "GET",
			url: "/response-headers?bad%20name=x",
		});
		expect(spaced.statusCode).toBe(400);
		expect(spaced.json()).toEqual({
			error: "invalid_header_name",
			header: "bad name",
		});

		const newline = await mock.server.inject({
			method: "GET",
			url: "/response-headers?x-custom=a%0Ab",
		});
		expect(newline.statusCode).toBe(400);
		expect(newline.json().error).toBe("invalid_header_name");

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
});
