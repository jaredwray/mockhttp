import type { FastifyInstance, FastifySchema } from "fastify";

const etagSchema: FastifySchema = {
	description: "Handles ETag-based conditional requests.",
	tags: ["Response Inspection"],
	params: {
		type: "object",
		properties: {
			etag: {
				type: "string",
				description: "The ETag value for the resource.",
			},
		},
		required: ["etag"],
	},
	response: {
		200: {
			type: "string",
			description: "Resource content for matching ETag.",
		},
		304: {
			type: "null",
			description: "Indicates the resource has not been modified.",
		},
		412: {
			type: "null",
			description: "Indicates a precondition failed due to mismatched ETag.",
		},
	},
};

export const etagRoutes = (fastify: FastifyInstance) => {
	fastify.get<{ Params: { etag: string } }>(
		"/etag/:etag",
		{ schema: etagSchema },
		async (request, reply) => {
			const { etag } = request.params;
			const ifNoneMatch = request.headers["if-none-match"];
			const ifMatch = request.headers["if-match"];

			if (ifNoneMatch === etag) {
				await reply.status(304).send();
				return;
			}

			if (ifMatch && ifMatch !== etag) {
				await reply.status(412).send();
				return;
			}

			await reply
				.header("ETag", etag)
				.send("Resource content for matching ETag.");
		},
	);
};
