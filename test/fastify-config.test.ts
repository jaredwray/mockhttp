import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { getFastifyConfig, rewriteUrl } from "../src/fastify-config.js";

describe("getFastifyConfig", () => {
	it("returns logger config when logging is enabled (default)", () => {
		const config = getFastifyConfig();
		expect(config.logger).not.toBe(false);
		expect(config.rewriteUrl).toBe(rewriteUrl);
	});

	it("disables the logger when logging is false", () => {
		const config = getFastifyConfig(false);
		expect(config.logger).toBe(false);
	});

	it("raises the router's maxParamLength past find-my-way's 100-char default", () => {
		const config = getFastifyConfig();
		expect(config.routerOptions.maxParamLength).toBeGreaterThan(100);
	});
});

describe("rewriteUrl", () => {
	const buildFastify = () => {
		const fastify = Fastify({ logger: false, rewriteUrl });
		fastify.get("/status/:code?", async () => ({ ok: true }));
		fastify.post("/status/:code?", async () => ({ ok: true }));
		fastify.get("/anything", async () => ({ ok: true }));
		fastify.get("/links/:n/:offset?", async () => ({ ok: true }));
		fastify.get("/", async () => ({ ok: true }));
		return fastify;
	};

	it("rewrites trailing segments to the parsable portion of the URL", async () => {
		const fastify = buildFastify();
		const response = await fastify.inject({
			method: "GET",
			url: "/status/429/foo",
		});
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ ok: true });
		await fastify.close();
	});

	it("rewrites a trailing slash variant of an unknown extension", async () => {
		const fastify = buildFastify();
		const response = await fastify.inject({
			method: "GET",
			url: "/status/429/foo/",
		});
		expect(response.statusCode).toBe(200);
		await fastify.close();
	});

	it("rewrites a trailing-slash-only path to the segments without the slash", async () => {
		const fastify = Fastify({ logger: false, rewriteUrl });
		fastify.get("/status/:code", async (request) => ({
			params: request.params,
		}));
		fastify.get("/*", async () => ({ matched: "wildcard" }));
		await fastify.ready();

		const response = await fastify.inject({
			method: "GET",
			url: "/status/429/",
		});
		expect(response.json()).toEqual({ params: { code: "429" } });

		await fastify.close();
	});

	it("rewrites several trailing segments down to a known route", async () => {
		const fastify = buildFastify();
		const response = await fastify.inject({
			method: "GET",
			url: "/status/200/foo/bar/baz",
		});
		expect(response.statusCode).toBe(200);
		await fastify.close();
	});

	it("preserves the query string when rewriting", async () => {
		const fastify = buildFastify();
		const response = await fastify.inject({
			method: "GET",
			url: "/status/200/foo?show_env=1",
		});
		expect(response.statusCode).toBe(200);
		await fastify.close();
	});

	it("respects the HTTP method when matching", async () => {
		const fastify = buildFastify();
		const response = await fastify.inject({
			method: "POST",
			url: "/status/201/extra",
		});
		expect(response.statusCode).toBe(200);
		await fastify.close();
	});

	it("does not rewrite when the URL already matches a route", async () => {
		const fastify = buildFastify();
		const response = await fastify.inject({
			method: "GET",
			url: "/anything",
		});
		expect(response.statusCode).toBe(200);
		await fastify.close();
	});

	it("returns 404 when no prefix of the URL matches a route", async () => {
		const fastify = buildFastify();
		const response = await fastify.inject({
			method: "GET",
			url: "/totally/unknown/path",
		});
		expect(response.statusCode).toBe(404);
		await fastify.close();
	});

	it("does not strip the first segment down to the root", async () => {
		const fastify = buildFastify();
		const response = await fastify.inject({
			method: "GET",
			url: "/unknown-root",
		});
		expect(response.statusCode).toBe(404);
		await fastify.close();
	});

	it("does not strip when an explicit wildcard subroute exists", async () => {
		const fastify = Fastify({ logger: false, rewriteUrl });
		fastify.get("/b/:id", async (request) => ({
			params: request.params,
			matched: "root",
		}));
		fastify.get("/b/:id/*", async (request) => ({
			params: request.params,
			matched: "wildcard",
		}));
		await fastify.ready();

		const subpath = await fastify.inject({
			method: "GET",
			url: "/b/abc/foo/bar",
		});
		expect(subpath.json()).toEqual({
			params: { id: "abc", "*": "foo/bar" },
			matched: "wildcard",
		});

		const root = await fastify.inject({ method: "GET", url: "/b/abc" });
		expect(root.json()).toEqual({ params: { id: "abc" }, matched: "root" });

		await fastify.close();
	});

	it("prefers a specific route over a wildcard catch-all when stripping", async () => {
		const fastify = Fastify({ logger: false, rewriteUrl });
		fastify.get("/status/:code", async () => ({ matched: "status" }));
		fastify.get("/*", async () => ({ matched: "wildcard" }));
		await fastify.ready();

		const stripped = await fastify.inject({
			method: "GET",
			url: "/status/200/extra",
		});
		expect(stripped.json()).toEqual({ matched: "status" });

		const wildcardOnly = await fastify.inject({
			method: "GET",
			url: "/unknown/path",
		});
		expect(wildcardOnly.json()).toEqual({ matched: "wildcard" });

		await fastify.close();
	});

	it("returns the original URL when the method is missing", () => {
		const fakeFastify = {
			findRoute: () => null,
		} as unknown as Parameters<typeof rewriteUrl>[0] extends never
			? never
			: import("fastify").FastifyInstance;
		const result = rewriteUrl.call(fakeFastify, {
			url: "/status/429/foo",
			method: undefined,
		} as unknown as import("node:http").IncomingMessage);
		expect(result).toBe("/status/429/foo");
	});

	it("treats routes with undefined params as specific", () => {
		const fakeFastify = {
			findRoute: () => ({ params: undefined }),
		} as unknown as import("fastify").FastifyInstance;
		const result = rewriteUrl.call(fakeFastify, {
			url: "/something/anything",
			method: "GET",
		} as unknown as import("node:http").IncomingMessage);
		expect(result).toBe("/something/anything");
	});

	it("returns '/' when the request URL is missing", () => {
		const fakeFastify = {
			findRoute: () => null,
		} as unknown as import("fastify").FastifyInstance;
		const result = rewriteUrl.call(fakeFastify, {
			method: "GET",
		} as unknown as import("node:http").IncomingMessage);
		expect(result).toBe("/");
	});
});
