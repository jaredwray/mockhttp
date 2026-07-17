import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";
import {
	encodeRequestBody,
	registerRawBodyFallbackParser,
} from "../http-methods/raw-body.js";

const anythingSchema: FastifySchema = {
	description: "Will return anything that you send it",
	tags: ["Anything"],
	response: {
		200: {
			type: "object",
			properties: {
				// Echo back all your params under `args`
				args: {
					type: "object",
					description: "Route parameters",
					additionalProperties: true,
				},

				// Echo back whatever was in the request.body. Any valid JSON
				// value, or the utf8/base64 string produced for non-JSON
				// content types - see raw-body.ts.
				data: {
					description: "Request body data",
				},

				// If you’re using fastify-multipart, you’ll get
				// files via request.files(); this just allows
				// you to mirror them back
				files: {
					type: "object",
					description: "Uploaded files",
					additionalProperties: true,
				},

				// If you parse application/x-www-form-urlencoded
				// these fields land in request.body too, but you can
				// mirror them separately if you like
				form: {
					description: "Form data",
				},

				headers: {
					type: "object",
					description: "Request headers",
					additionalProperties: true,
				},

				json: {
					description: "Parsed JSON body",
				},

				method: { type: "string", description: "HTTP method used" },
				origin: { type: "string", description: "Origin of the request" },
				url: { type: "string", description: "Request URL" },
			},
			// Don’t allow any other top-level keys in your response
			additionalProperties: false,
		},
	},
};

export type AnythingResponse = {
	args: Record<string, unknown>;
	data: unknown;
	files: Record<string, unknown>;
	form: unknown;
	headers: Record<string, unknown>;
	json: unknown;
	method: string;
	origin: string;
	url: string;
};

export const anythingRoute = (fastify: FastifyInstance) => {
	registerRawBodyFallbackParser(fastify);

	const handler = async (request: FastifyRequest, reply: FastifyReply) => {
		const body =
			encodeRequestBody(request.body, request.headers["content-type"]) ?? {};
		const response: AnythingResponse = {
			args: request.query as Record<string, unknown>,
			data: body,
			// biome-ignore lint/suspicious/noExplicitAny: expected
			files: (request.raw as any)?.files ?? {},
			form: body,
			headers: request.headers,
			json: body,
			method: request.method,
			origin: request.headers.origin ?? request.headers.host ?? "",
			url: request.url,
		};

		await reply.send(response);
	};

	const noValidation = {
		schema: anythingSchema,
		// Skip AJV on *this* route
		/* v8 ignore next -- @preserve */
		validatorCompiler: () => () => true,
	};

	fastify.get("/anything", noValidation, handler);
	fastify.post("/anything", noValidation, handler);
	fastify.put("/anything", noValidation, handler);
	fastify.patch("/anything", noValidation, handler);
	fastify.delete("/anything", noValidation, handler);
};
