import type { FastifyInstance, FastifyRequest, FastifySchema } from "fastify";

const cacheGetSchema: FastifySchema = {
	description: "Handles cache validation and retrieval.",
	tags: ["Response Inspection"],
	response: {
		200: {
			type: "string",
			description: "The cached content or resource.",
		},
		304: {
			type: "null",
			description: "Indicates the resource has not been modified.",
		},
	},
};

const cacheSetSchema: FastifySchema = {
	description: "Sets a Cache-Control header for n seconds.",
	tags: ["Response Inspection"],
	params: {
		type: "object",
		properties: {
			value: {
				type: "integer",
				description: "Number of seconds to cache the resource.",
			},
		},
		required: ["value"],
	},
	response: {
		200: {
			type: "string",
			description: "Confirmation message for setting cache.",
		},
	},
};

export const cacheRoutes = (fastify: FastifyInstance) => {
	fastify.get(
		"/cache",
		{ schema: cacheGetSchema },
		async (request: FastifyRequest, reply) => {
			const ifModifiedSince = request.headers["if-modified-since"];
			const ifNoneMatch = request.headers["if-none-match"];

			if (ifModifiedSince ?? ifNoneMatch) {
				await reply.status(304).send();
				return;
			}

			await reply.send("Cache content or resource response here.");
		},
	);

	fastify.get<{ Params: { value: number } }>(
		"/cache/:value",
		{ schema: cacheSetSchema },
		async (request, reply) => {
			const { value } = request.params;
			await reply
				.header("Cache-Control", `max-age=${value}`)
				.send(`Cache-Control set for ${value} seconds.`);
		},
	);
};
