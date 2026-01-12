import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

type Base64Request = FastifyRequest<{
	Params: { value: string };
}>;

const base64Schema: FastifySchema = {
	description: "Decodes base64url-encoded string",
	tags: ["Dynamic Data"],
	params: {
		type: "object",
		properties: {
			value: {
				type: "string",
				description: "Base64 encoded value to decode",
			},
		},
		required: ["value"],
	},
	response: {
		200: {
			type: "string",
			description: "Decoded value",
		},
		400: {
			type: "object",
			properties: {
				error: { type: "string" },
			},
		},
	},
};

export const base64Route = (fastify: FastifyInstance) => {
	fastify.get(
		"/base64/:value",
		{ schema: base64Schema },
		async (request: Base64Request, reply: FastifyReply) => {
			const { value } = request.params;

			try {
				// Support both standard base64 and base64url encoding
				const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
				const decoded = Buffer.from(normalizedValue, "base64").toString(
					"utf-8",
				);

				return reply
					.header("Content-Type", "text/html; charset=utf-8")
					.send(decoded);
			} catch {
				return reply.code(400).send({ error: "Incorrect Base64 data" });
			}
		},
	);
};
