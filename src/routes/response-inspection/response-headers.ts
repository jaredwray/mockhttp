import { validateHeaderName, validateHeaderValue } from "node:http";
import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";
import { escape as escapeHtml } from "html-escaper";

const invalidHeaderSchema = {
	type: "object",
	additionalProperties: true,
	properties: {
		error: { type: "string" },
		statusCode: { type: "integer" },
		code: { type: "string" },
		message: { type: "string" },
	},
	description: "A header name is not permitted.",
};

const responseHeadersSchema: FastifySchema = {
	description:
		"Copy query fields into response headers. Return HTTP 400 for a name the server does not permit.",
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
		"Copy query and body fields into response headers. Return HTTP 400 for a name the server does not permit.",
};

// RFC 9110 section 5.6.2 defines the characters of a header name.
const HEADER_NAME_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

// The server owns these headers. Node.js throws in writeHead for some of them.
const RESERVED_HEADER_NAMES = new Set([
	"connection",
	"content-length",
	"host",
	"http2-settings",
	"keep-alive",
	"proxy-connection",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
]);

const headerError = (name: string) =>
	`The header name "${escapeHtml(name)}" is not permitted.`;

/**
 * Return true when the name and the value can be a response header.
 * A colon prefix fails the token rule. A reserved name is rejected.
 */
function isPermittedHeader(name: string, value: string): boolean {
	if (
		!HEADER_NAME_TOKEN.test(name) ||
		RESERVED_HEADER_NAMES.has(name.toLowerCase())
	) {
		return false;
	}
	try {
		validateHeaderName(name);
		validateHeaderValue(name, value);
		validateHeaderValue(name, escapeHtml(value));
		return true;
	} catch {
		return false;
	}
}

const sendResponseHeaders = async (
	reply: FastifyReply,
	sources: Array<Record<string, string>>,
) => {
	const entries: Array<[string, string]> = [];
	for (const source of sources) {
		for (const [name, value] of Object.entries(source)) {
			entries.push([name, value]);
		}
	}

	for (const [name, value] of entries) {
		if (!isPermittedHeader(name, value)) {
			return reply.code(400).send({ error: headerError(name) });
		}
	}

	// A null prototype keeps a prototype key as an own field.
	const body: Record<string, string> = Object.create(null);
	for (const [name, value] of entries) {
		const escaped = escapeHtml(value);
		reply.header(name, escaped);
		body[name] = escaped;
	}
	await reply.send(body);
};

export const responseHeadersRoutes = (fastify: FastifyInstance) => {
	fastify.get(
		"/response-headers",
		{ schema: responseHeadersSchema },
		async (request: FastifyRequest, reply) => {
			await sendResponseHeaders(reply, [
				request.query as Record<string, string>,
			]);
		},
	);

	fastify.post(
		"/response-headers",
		{ schema: responseHeadersPostSchema },
		async (request: FastifyRequest, reply) => {
			const body = request.body == null ? {} : request.body;
			await sendResponseHeaders(reply, [
				request.query as Record<string, string>,
				body as Record<string, string>,
			]);
		},
	);
};
