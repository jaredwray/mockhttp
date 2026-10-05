import type { FastifyRequest } from "fastify";
import { firstHeader } from "./http-headers.js";

const ALLOWED_FORWARDED_HOSTS = new Set(["mockhttp.org", "www.mockhttp.org"]);

function hostnameOf(host: string): string {
	const trimmed = host.trim().toLowerCase();
	if (trimmed.startsWith("[")) {
		const end = trimmed.indexOf("]");
		if (end !== -1) {
			return trimmed.slice(1, end);
		}
	}

	const colon = trimmed.indexOf(":");
	if (colon === -1) {
		return trimmed;
	}

	return trimmed.slice(0, colon);
}

export function publicHost(
	request: FastifyRequest,
	fallbackHost: string,
): string {
	const forwarded = firstHeader(request.headers["x-forwarded-host"]);
	if (forwarded && ALLOWED_FORWARDED_HOSTS.has(hostnameOf(forwarded))) {
		return hostnameOf(forwarded);
	}

	return firstHeader(request.headers.host) ?? fallbackHost;
}

export function publicProtocol(request: FastifyRequest): "http" | "https" {
	const forwarded = firstHeader(request.headers["x-forwarded-proto"]);
	const protocol = (forwarded ?? request.protocol).toLowerCase();
	return protocol.includes("https") ? "https" : "http";
}

export function publicOrigin(
	request: FastifyRequest,
	fallbackHost = "mockhttp.org",
): string {
	return `${publicProtocol(request)}://${publicHost(request, fallbackHost)}`;
}
