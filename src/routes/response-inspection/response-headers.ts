import { validateHeaderName, validateHeaderValue } from "node:http";
import type { FastifyInstance, FastifyReply, FastifySchema } from "fastify";
import { escape as escapeHtml } from "html-escaper";

/**
 * RFC 7230 token. A header name is one or more of these characters.
 * The set matches the `tchar` rule.
 */
const HEADER_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Framing and hop-by-hop names. Node can abort the process when these
 * names are set on a response.
 */
const FRAMING_HEADERS = new Set([
	"trailer",
	"transfer-encoding",
	"content-length",
	"connection",
	"keep-alive",
	"upgrade",
	"te",
	"proxy-connection",
	"host",
]);

const invalidHeaderSchema = {
	type: "object",
	additionalProperties: true,
	properties: {
		error: { type: "string" },
		header: { type: "string" },
		statusCode: { type: "integer" },
		code: { type: "string" },
		message: { type: "string" },
	},
};

const responseHeadersSchema: FastifySchema = {
	description:
		"Copy query fields into response headers. Return HTTP 400 for an invalid name, a framing name, or a name that starts with a colon.",
	tags: ["Response Inspection"],
	querystring: {
		type: "object",
		additionalProperties: true,
		description:
			"Freeform query string parameters to be added as response headers.",
	},
	response: {
		200: {
			type: "object",
			additionalProperties: true,
			description: "Response headers as per query string parameters.",
		},
		400: invalidHeaderSchema,
	},
};

const responseHeadersPostSchema: FastifySchema = {
	...responseHeadersSchema,
	description:
		"Copy query and body fields into response headers. Return HTTP 400 for an invalid name, a framing name, or a name that starts with a colon.",
};

/**
 * Accept a header name, or return false.
 * Reject a colon prefix, a non-token, and a framing name.
 */
function isAllowedHeaderName(name: string): boolean {
	if (name.startsWith(":")) {
		return false;
	}
	if (!HEADER_TOKEN.test(name)) {
		return false;
	}
	return !FRAMING_HEADERS.has(name.toLowerCase());
}

/**
 * Store one echo header.
 * Wrap `reply.header` so an invalid header returns no value.
 * The caller sends HTTP 400 instead of a process crash.
 */
function commitEchoHeader(
	reply: FastifyReply,
	name: string,
	raw: string,
): string | undefined {
	try {
		if (!isAllowedHeaderName(name)) {
			throw new Error("rejected");
		}
		validateHeaderName(name);
		validateHeaderValue(name, raw);
		const escaped = escapeHtml(raw);
		validateHeaderValue(name, escaped);
		reply.header(name, escaped);
		return escaped;
	} catch {
		return undefined;
	}
}

async function echoHeaders(
	reply: FastifyReply,
	sources: Array<Record<string, string>>,
) {
	// A null prototype keeps `__proto__` as an own field.
	const body: Record<string, string> = Object.create(null);
	const committedHeaders: string[] = [];
	for (const source of sources) {
		for (const [name, raw] of Object.entries(source)) {
			const escaped = commitEchoHeader(reply, name, raw);
			if (escaped === undefined) {
				for (const setName of committedHeaders) {
					reply.removeHeader(setName);
				}
				return reply.code(400).send({
					error: "invalid_header_name",
					header: name,
				});
			}
			body[name] = escaped;
			committedHeaders.push(name);
		}
	}
	return reply.send(body);
}

export const responseHeadersRoutes = (fastify: FastifyInstance) => {
	fastify.get(
		"/response-headers",
		{ schema: responseHeadersSchema },
		async (request, reply) => {
			const queryParameters = request.query as Record<string, string>;
			return echoHeaders(reply, [queryParameters]);
		},
	);

	fastify.post(
		"/response-headers",
		{ schema: responseHeadersPostSchema },
		async (request, reply) => {
			const queryParameters = request.query as Record<string, string>;
			const body = request.body == null ? {} : request.body;
			return echoHeaders(reply, [
				queryParameters,
				body as Record<string, string>,
			]);
		},
	);
};
