import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

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

				// Echo back whatever was in the request.body
				data: {
					type: "object",
					description: "Request body data",
					additionalProperties: true,
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
					type: "object",
					description: "Form data",
					additionalProperties: true,
				},

				headers: {
					type: "object",
					description: "Request headers",
					additionalProperties: true,
				},

				json: {
					type: "object",
					description: "Parsed JSON body",
					additionalProperties: true,
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
	data: Record<string, unknown>;
	files: Record<string, unknown>;
	form: Record<string, unknown>;
	headers: Record<string, unknown>;
	json: Record<string, unknown>;
	method: string;
	origin: string;
	url: string;
};

export const anythingRoute = (fastify: FastifyInstance) => {
	const handler = async (request: FastifyRequest, reply: FastifyReply) => {
		const response: AnythingResponse = {
			args: request.query as Record<string, unknown>,
			data: (request.body as Record<string, unknown>) ?? {},
			// biome-ignore lint/suspicious/noExplicitAny: expected
			files: (request.raw as any)?.files ?? {},
			form: (request.body as Record<string, unknown>) ?? {},
			headers: request.headers,
			json: (request.body as Record<string, unknown>) ?? {},
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
