import type { FastifyInstance, FastifySchema } from "fastify";

const postCookieRouteSchema: FastifySchema = {
	description: "Set a cookie",
	tags: ["Cookies"],
	body: {
		type: "object",
		properties: {
			name: { type: "string" },
			value: { type: "string" },
			expires: { type: "string", format: "date-time" },
		},
		required: ["name", "value"],
		additionalProperties: false,
	},
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

export const postCookieRoute = (fastify: FastifyInstance) => {
	fastify.post<{ Body: { name: string; value: string; expires?: string } }>(
		"/cookies",
		{ schema: postCookieRouteSchema },
		async (request, reply) => {
			const { name, value, expires } = request.body;
			if (expires) {
				const date = new Date(expires);
				reply.setCookie(name, value, { path: "/", expires: date });
			} else {
				reply.setCookie(name, value, { path: "/" });
			}

			// Send back the current cookies
			return reply.status(200).send();
		},
	);
};
