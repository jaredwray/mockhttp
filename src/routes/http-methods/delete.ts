import type { FastifyInstance, FastifyRequest, FastifySchema } from "fastify";

const deleteSchema: FastifySchema = {
	description: "Handles a DELETE request and returns request information",
	tags: ["HTTP Methods"],
	response: {
		200: {
			type: "object",
			properties: {
				method: { type: "string" },
				headers: { type: "object", additionalProperties: { type: "string" } },
				body: {
					oneOf: [
						{ type: "object", additionalProperties: true },
						{ type: "string" },
						{ type: "null" },
					],
				},
			},
			required: ["method", "headers"],
		},
	},
};

export const deleteRoute = (fastify: FastifyInstance) => {
	fastify.delete(
		"/delete",
		{ schema: deleteSchema },
		async (request: FastifyRequest) => ({
			method: "DELETE",
			headers: request.headers,
			body: request.body,
		}),
	);
};
