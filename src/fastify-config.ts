import type { IncomingMessage } from "node:http";
import type { FastifyInstance } from "fastify";

function isSpecificMatch(
	route: ReturnType<FastifyInstance["findRoute"]> | null,
): boolean {
	if (!route) {
		return false;
	}
	const params = route.params as Record<string, unknown> | undefined;
	return params === undefined || params["*"] === undefined;
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

	if (isSpecificMatch(this.findRoute({ method, url: originalUrl }))) {
		return originalUrl;
	}

	const queryIdx = originalUrl.indexOf("?");
	const path = queryIdx >= 0 ? originalUrl.slice(0, queryIdx) : originalUrl;
	const query = queryIdx >= 0 ? originalUrl.slice(queryIdx) : "";

	const segments = path.split("/").filter(Boolean);

	while (segments.length > 1) {
		segments.pop();
		const candidatePath = `/${segments.join("/")}`;
		if (isSpecificMatch(this.findRoute({ method, url: candidatePath }))) {
			return candidatePath + query;
		}
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
