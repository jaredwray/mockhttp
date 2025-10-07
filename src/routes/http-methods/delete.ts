import type { FastifyInstance, FastifyRequest, FastifySchema } from "fastify";

const deleteSchema: FastifySchema = {
	description: "Handles a DELETE request and returns request information",
	tags: ["HTTP Methods"],
	body: {
		oneOf: [
			{
				type: "object",
				additionalProperties: true,
				description: "JSON body of the DELETE request",
			},
			{
				type: "string",
				description: "String body of the DELETE request",
			},
		],
	},
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
					],
				},
			},
			required: ["method", "headers", "body"],
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
