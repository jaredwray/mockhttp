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

/**
 * Parses an `application/x-www-form-urlencoded` body string into a plain
 * object (last value wins for repeated keys, matching how this server
 * already exposes `request.query` for querystrings).
 *
 * Non-string input (Fastify's `parseAs: "string"` guarantees a string in
 * practice, but the parser type signature is `unknown`) parses as empty.
 *
 * `Object.fromEntries` wouldn't trigger the `Object.prototype.__proto__`
 * setter here, so building this by hand isn't closing an exploitable
 * prototype-pollution hole - but it does stop a form field literally named
 * "constructor" or "__proto__" from shadowing the real one on the object
 * this server echoes back to the client.
 */
export function parseFormUrlencoded(body: unknown): Record<string, string> {
	if (typeof body !== "string") {
		return {};
	}

	const parsed: Record<string, string> = {};
	for (const [key, value] of new URLSearchParams(body)) {
		if (key === "__proto__" || key === "constructor") {
			continue;
		}
		parsed[key] = value;
	}

	return parsed;
}

/**
 * Registers an `application/x-www-form-urlencoded` body parser on the given
 * Fastify instance. Fastify only understands `application/json` and
 * `text/plain` out of the box, so a plain HTML form POST (or any client that
 * sends url-encoded bodies, e.g. GM_xmlhttpRequest/XHR form submissions)
 * otherwise gets rejected with a 415 before it ever reaches a route handler.
 */
export function registerFormUrlencodedParser(fastify: FastifyInstance) {
	fastify.addContentTypeParser(
		"application/x-www-form-urlencoded",
		{ parseAs: "string" },
		(_request, body, done) => {
			done(null, parseFormUrlencoded(body));
		},
	);
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
