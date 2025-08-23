import type { FastifyInstance, FastifyRequest, FastifySchema } from "fastify";

const userAgentSchema: FastifySchema = {
	description: "Returns the User-Agent header of the client request",
	tags: ["Request Inspection"],
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: "object",
			properties: {
				userAgent: {
					type: "string",
					description: "The User-Agent header of the client request",
				},
			},
			required: ["userAgent"],
		},
	},
};

export const userAgentRoute = (fastify: FastifyInstance) => {
	fastify.get(
		"/user-agent",
		{ schema: userAgentSchema },
		async (request: FastifyRequest) => {
			const userAgent = request.headers["user-agent"];

			return {
				userAgent,
			};
		},
	);
};
