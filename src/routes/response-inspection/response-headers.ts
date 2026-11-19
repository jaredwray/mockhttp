import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";
import { escape as escapeHtml } from "html-escaper";

const responseHeadersSchema: FastifySchema = {
	description: "Returns a set of response headers based on the query string.",
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
		400: {
			type: "object",
			properties: {
				error: { type: "string" },
			},
			description: "A header name is not permitted.",
		},
	},
};

// RFC 9110 section 5.6.2 defines the characters of a header name.
const HEADER_NAME_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

// The server owns these headers. Node.js throws in writeHead for some of them,
// and Fastify cannot send an error response after that.
const RESERVED_HEADER_NAMES = new Set([
	"connection",
	"http2-settings",
	"keep-alive",
	"proxy-connection",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
]);

const isPermittedHeaderName = (name: string): boolean =>
	HEADER_NAME_TOKEN.test(name) &&
	!RESERVED_HEADER_NAMES.has(name.toLowerCase());

const sendResponseHeaders = async (
	reply: FastifyReply,
	parameters: Record<string, string>,
) => {
	const rejectedName = Object.keys(parameters).find(
		(name) => !isPermittedHeaderName(name),
	);
	if (rejectedName !== undefined) {
		return reply.code(400).send({
			error: `The header name "${escapeHtml(rejectedName)}" is not permitted.`,
		});
	}

	const cleanedResponse = Object.fromEntries(
		Object.entries(parameters).map(([key, value]) => [key, escapeHtml(value)]),
	);
	reply.headers(cleanedResponse);
	await reply.send(cleanedResponse);
};

export const responseHeadersRoutes = (fastify: FastifyInstance) => {
	fastify.get(
		"/response-headers",
		{ schema: responseHeadersSchema },
		async (request: FastifyRequest, reply) => {
			await sendResponseHeaders(reply, request.query as Record<string, string>);
		},
	);

	fastify.post(
		"/response-headers",
		{ schema: responseHeadersSchema },
		async (request: FastifyRequest, reply) => {
			await sendResponseHeaders(reply, {
				...(request.query as Record<string, string>),
				...(request.body as Record<string, string> | undefined),
			});
		},
	);
};
