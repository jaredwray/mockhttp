import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

const getCookiesRouteSchema: FastifySchema = {
	description: "Return cookies from the request",
	tags: ["Cookies"],
	response: {
		200: {
			type: "object",
			properties: {
				cookies: {
					type: "object",
					additionalProperties: { type: "string" },
				},
			},
			required: ["cookies"],
		},
	},
};

export const getCookiesRoute = (fastify: FastifyInstance) => {
	fastify.get(
		"/cookies",
		{ schema: getCookiesRouteSchema },
		async (request: FastifyRequest, reply: FastifyReply) => {
			reply.type("application/json");
			await reply.send({
				cookies: request.cookies,
			});
		},
	);
};
