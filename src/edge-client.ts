import { timingSafeEqual } from "node:crypto";
import type { RateLimitPluginOptions } from "@fastify/rate-limit";
import type { FastifyRequest } from "fastify";
import { EDGE_CLIENT_IP_HEADER, EDGE_TOKEN_HEADER } from "./edge-headers.js";
import { firstHeader } from "./http-headers.js";

function tokenMatches(provided: string, expected: string): boolean {
	const providedBytes = Buffer.from(provided);
	const expectedBytes = Buffer.from(expected);
	if (providedBytes.length !== expectedBytes.length) {
		return false;
	}

	return timingSafeEqual(providedBytes, expectedBytes);
}

export function trustedEdgeClientIp(
	request: FastifyRequest,
	edgeProxyToken: string | undefined,
): string | undefined {
	if (!edgeProxyToken) {
		return undefined;
	}

	const token = firstHeader(request.headers[EDGE_TOKEN_HEADER]);
	const clientIp = firstHeader(request.headers[EDGE_CLIENT_IP_HEADER]);
	if (!token || !clientIp || !tokenMatches(token, edgeProxyToken)) {
		return undefined;
	}

	return clientIp;
}

export function withEdgeRateLimitKey(
	options: RateLimitPluginOptions,
	edgeProxyToken: string | undefined,
): RateLimitPluginOptions {
	if (!edgeProxyToken) {
		return options;
	}

	const configuredKey = options.keyGenerator;
	return {
		...options,
		keyGenerator: (request) => {
			const clientIp = trustedEdgeClientIp(request, edgeProxyToken);
			if (clientIp) {
				return clientIp;
			}

			if (configuredKey) {
				return configuredKey(request);
			}

			return request.ip;
		},
	};
}
