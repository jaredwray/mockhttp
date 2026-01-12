import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifySchema } from "fastify";

const uuidSchema: FastifySchema = {
	description: "Return a UUID4",
	tags: ["Dynamic Data"],
	response: {
		200: {
			type: "object",
			properties: {
				uuid: { type: "string", format: "uuid" },
			},
			required: ["uuid"],
		},
	},
};

export const uuidRoute = (fastify: FastifyInstance) => {
	fastify.get("/uuid", { schema: uuidSchema }, async () => ({
		uuid: randomUUID(),
	}));
};
