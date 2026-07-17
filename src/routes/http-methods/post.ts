import type { FastifyInstance, FastifyRequest, FastifySchema } from "fastify";
import {
	encodeRequestBody,
	registerRawBodyFallbackParser,
} from "./raw-body.js";

const postSchema: FastifySchema = {
	description: "Handles a POST request and returns request information",
	tags: ["HTTP Methods"],
	response: {
		200: {
			type: "object",
			properties: {
				method: { type: "string" },
				headers: { type: "object", additionalProperties: { type: "string" } },
				// Any valid JSON body shape (object, array, string, number,
				// boolean, null) plus the utf8/base64 string produced for
				// non-JSON content types - see raw-body.ts.
				body: {},
			},
			required: ["method", "headers", "body"],
		},
	},
};

export const postRoute = (fastify: FastifyInstance) => {
	registerRawBodyFallbackParser(fastify);

	fastify.post(
		"/post",
		{ schema: postSchema },
		async (request: FastifyRequest) => ({
			method: "POST",
			headers: request.headers,
			// A request with no body at all (no Content-Type, nothing for any
			// parser to run on) leaves request.body as undefined; fall back to
			// {} so the required "body" response field is never missing.
			body:
				encodeRequestBody(request.body, request.headers["content-type"]) ?? {},
		}),
	);
};
