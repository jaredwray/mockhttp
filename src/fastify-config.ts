import type { IncomingMessage } from "node:http";
import type { FastifyInstance } from "fastify";

function isSpecificMatch(
	route: ReturnType<FastifyInstance["findRoute"]> | null,
): boolean {
	if (!route) {
		return false;
	}
	const params = route.params as Record<string, unknown> | undefined;
	// A literal route or one whose params include something other than the
	// catch-all wildcard is considered specific. `/*` (params keyed only by
	// "*") is a fallback that should defer to a more specific prefix match.
	if (!params) {
		return true;
	}
	const keys = Object.keys(params);
	return keys.length === 0 || keys.some((k) => k !== "*");
}

export function rewriteUrl(
	this: FastifyInstance,
	req: IncomingMessage,
): string {
	const originalUrl = req.url ?? "/";
	const method = req.method;
	if (!method) {
		return originalUrl;
	}

	const queryIdx = originalUrl.indexOf("?");
	const path = queryIdx >= 0 ? originalUrl.slice(0, queryIdx) : originalUrl;
	const query = queryIdx >= 0 ? originalUrl.slice(queryIdx) : "";

	if (isSpecificMatch(this.findRoute({ method, url: path }))) {
		return originalUrl;
	}

	const segments = path.split("/").filter(Boolean);

	while (segments.length >= 1) {
		const candidatePath = `/${segments.join("/")}`;
		if (
			candidatePath !== path &&
			isSpecificMatch(this.findRoute({ method, url: candidatePath }))
		) {
			return candidatePath + query;
		}
		if (segments.length === 1) {
			break;
		}
		segments.pop();
	}

	return originalUrl;
}

export function getFastifyConfig(logging = true) {
	return {
		logger: logging
			? {
					transport: {
						target: "pino-pretty",
						options: {
							colorize: true,
							translateTime: true,
							ignore: "pid,hostname",
							singleLine: true,
						},
					},
				}
			: false,
		rewriteUrl,
	};
}
