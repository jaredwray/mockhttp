import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { firstHeader } from "../src/http-headers.js";
import {
	publicHost,
	publicOrigin,
	publicProtocol,
} from "../src/public-origin.js";

function asRequest(
	headers: Record<string, string | string[] | undefined>,
	protocol = "http",
): FastifyRequest {
	return { headers, protocol } as FastifyRequest;
}

describe("public origin", () => {
	it("reads the first header token", () => {
		expect(firstHeader(undefined)).toBeUndefined();
		expect(firstHeader("")).toBeUndefined();
		expect(firstHeader("   ")).toBeUndefined();
		expect(firstHeader(",mockhttp.org")).toBeUndefined();
		expect(firstHeader(["mockhttp.org, evil.example", "other"])).toBe(
			"mockhttp.org",
		);
	});

	it("uses an allowlisted forwarded host and protocol", () => {
		const request = asRequest(
			{
				host: "mockhttp.wasmer.app",
				"x-forwarded-host": "mockhttp.org:443",
				"x-forwarded-proto": "HTTPS,http",
			},
			"http",
		);
		expect(publicHost(request, "localhost")).toBe("mockhttp.org");
		expect(publicProtocol(request)).toBe("https");
		expect(publicOrigin(request)).toBe("https://mockhttp.org");
	});

	it("accepts www.mockhttp.org from a header list", () => {
		const request = asRequest({
			host: "mockhttp.wasmer.app",
			"x-forwarded-host": ["www.mockhttp.org, evil.example"],
			"x-forwarded-proto": ["http"],
		});
		expect(publicOrigin(request, "localhost")).toBe("http://www.mockhttp.org");
	});

	it("ignores a forwarded host outside the allowlist", () => {
		const request = asRequest(
			{
				host: "docs.example.test",
				"x-forwarded-host": "evil.example",
				"x-forwarded-proto": "http",
			},
			"https",
		);
		expect(publicOrigin(request)).toBe("http://docs.example.test");
	});

	it("ignores bracketed hosts that are not allowlisted", () => {
		expect(
			publicHost(
				asRequest({
					host: "localhost",
					"x-forwarded-host": "[2001:db8::1]",
				}),
				"fallback.test",
			),
		).toBe("localhost");
		expect(
			publicHost(
				asRequest({
					"x-forwarded-host": "[::1",
				}),
				"fallback.test",
			),
		).toBe("fallback.test");
	});

	it("falls back when the request has no host", () => {
		expect(publicOrigin(asRequest({}), "localhost")).toBe("http://localhost");
		expect(publicProtocol(asRequest({}, "https"))).toBe("https");
	});
});
