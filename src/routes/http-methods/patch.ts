import type { FastifyInstance, FastifyRequest, FastifySchema } from "fastify";

const patchSchema: FastifySchema = {
	description: "Handles a PATCH request and returns request information",
	tags: ["HTTP Methods"],
	body: {
		type: "object",
		additionalProperties: true,
		description: "The body of the PATCH request",
	},
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: "object",
			properties: {
				method: { type: "string" },
				headers: { type: "object", additionalProperties: { type: "string" } },
				body: { type: "object", additionalProperties: true },
			},
			required: ["method", "headers", "body"],
		},
	},
};

export const patchRoute = (fastify: FastifyInstance) => {
	fastify.patch(
		"/patch",
		{ schema: patchSchema },
		async (request: FastifyRequest) => ({
			method: "PATCH",
			headers: request.headers,
			body: request.body,
		}),
	);
};
