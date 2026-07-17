import type { FastifyInstance } from "fastify";

const TEXT_CONTENT_TYPE_REGEX =
	/^(text\/|application\/(json|xml|x-www-form-urlencoded|javascript))/i;

/**
 * Registers a catch-all content-type parser, scoped to whichever plugin
 * instance it's called on, that captures any request body Fastify's
 * built-in parsers don't already handle (json, text/plain) as a raw Buffer
 * instead of rejecting it with 415 Unsupported Media Type.
 *
 * Because `fastify.addContentTypeParser` only tries a "*" parser once no
 * more specific one matches, this doesn't change how already-handled
 * content types (e.g. application/json) are parsed - it only fills in the
 * gap for everything else (application/octet-stream, image/*,
 * multipart/form-data, missing Content-Type, etc).
 */
export function registerRawBodyFallbackParser(fastify: FastifyInstance) {
	fastify.addContentTypeParser(
		"*",
		{ parseAs: "buffer" },
		(_request, body, done) => {
			done(null, body);
		},
	);
}

/**
 * Converts a parsed request body into the value this server echoes back to
 * clients. Objects/strings (already produced by Fastify's json/text/
 * urlencoded parsers) pass straight through; a raw Buffer (from
 * {@link registerRawBodyFallbackParser}) is decoded as utf8 text for
 * textual content types, or base64 otherwise - the same rule
 * `src/routes/bins/capture.ts` already uses for its request-bin bodies.
 */
export function encodeRequestBody(
	body: unknown,
	contentType: string | undefined,
): unknown {
	if (!Buffer.isBuffer(body)) {
		return body;
	}
	if (body.length === 0) {
		return "";
	}

	const isText = contentType
		? TEXT_CONTENT_TYPE_REGEX.test(contentType)
		: false;
	return isText ? body.toString("utf8") : body.toString("base64");
}
