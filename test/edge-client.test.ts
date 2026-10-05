import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import {
	trustedEdgeClientIp,
	withEdgeRateLimitKey,
} from "../src/edge-client.js";
import {
	EDGE_CLIENT_IP_HEADER,
	EDGE_TOKEN_HEADER,
} from "../src/edge-headers.js";

function asRequest(
	headers: Record<string, string | string[] | undefined>,
	ip = "127.0.0.1",
): FastifyRequest {
	return { headers, ip } as FastifyRequest;
}

describe("edge client rate limit key", () => {
	it("ignores forwarded client identity without a configured token", () => {
		const request = asRequest({
			[EDGE_TOKEN_HEADER]: "secret",
			[EDGE_CLIENT_IP_HEADER]: "203.0.113.10",
		});
		expect(trustedEdgeClientIp(request, undefined)).toBeUndefined();
		const options = { max: 1, timeWindow: 1000 };
		expect(withEdgeRateLimitKey(options, undefined)).toBe(options);
	});

	it("trusts the first client ip when the token matches", () => {
		const request = asRequest({
			[EDGE_TOKEN_HEADER]: ["secret", "other"],
			[EDGE_CLIENT_IP_HEADER]: "203.0.113.10, 198.51.100.2",
		});
		expect(trustedEdgeClientIp(request, "secret")).toBe("203.0.113.10");
	});

	it("rejects a missing, blank, or different token", () => {
		expect(
			trustedEdgeClientIp(
				asRequest({
					[EDGE_CLIENT_IP_HEADER]: "203.0.113.10",
				}),
				"secret",
			),
		).toBeUndefined();
		expect(
			trustedEdgeClientIp(
				asRequest({
					[EDGE_TOKEN_HEADER]: "secret",
					[EDGE_CLIENT_IP_HEADER]: "   ",
				}),
				"secret",
			),
		).toBeUndefined();
		expect(
			trustedEdgeClientIp(
				asRequest({
					[EDGE_TOKEN_HEADER]: "nope",
					[EDGE_CLIENT_IP_HEADER]: "203.0.113.10",
				}),
				"secret",
			),
		).toBeUndefined();
		expect(
			trustedEdgeClientIp(
				asRequest({
					[EDGE_TOKEN_HEADER]: "secreT",
					[EDGE_CLIENT_IP_HEADER]: "203.0.113.10",
				}),
				"secret",
			),
		).toBeUndefined();
	});

	it("uses the trusted client ip, then a custom key, then the connecting ip", () => {
		const options = withEdgeRateLimitKey(
			{
				max: 1,
				timeWindow: 1000,
				keyGenerator: () => "custom",
			},
			"secret",
		);
		const keyGenerator = options.keyGenerator as NonNullable<
			typeof options.keyGenerator
		>;

		expect(
			keyGenerator(
				asRequest({
					[EDGE_TOKEN_HEADER]: "secret",
					[EDGE_CLIENT_IP_HEADER]: "203.0.113.10",
				}),
			),
		).toBe("203.0.113.10");
		expect(
			keyGenerator(
				asRequest({
					[EDGE_TOKEN_HEADER]: "nope",
					[EDGE_CLIENT_IP_HEADER]: "203.0.113.10",
				}),
			),
		).toBe("custom");

		const connecting = withEdgeRateLimitKey(
			{ max: 1, timeWindow: 1000 },
			"secret",
		);
		const connectingKey = connecting.keyGenerator as NonNullable<
			typeof connecting.keyGenerator
		>;
		expect(
			connectingKey(
				asRequest(
					{
						[EDGE_TOKEN_HEADER]: "nope",
					},
					"198.51.100.8",
				),
			),
		).toBe("198.51.100.8");
	});
});
