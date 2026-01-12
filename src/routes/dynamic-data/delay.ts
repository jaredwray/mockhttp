import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

type DelayRequest = FastifyRequest<{
	Params: { delay: string };
	Querystring: Record<string, string>;
}>;

const delaySchema: FastifySchema = {
	description: "Returns a delayed response (max of 10 seconds)",
	tags: ["Dynamic Data"],
	params: {
		type: "object",
		properties: {
			delay: {
				type: "string",
				description: "Delay in seconds (max 10)",
			},
		},
		required: ["delay"],
	},
	querystring: {
		type: "object",
		additionalProperties: true,
	},
	response: {
		200: {
			type: "object",
			properties: {
				args: { type: "object" },
				data: { type: "string" },
				files: { type: "object" },
				form: { type: "object" },
				headers: { type: "object" },
				origin: { type: "string" },
				url: { type: "string" },
			},
		},
		400: {
			type: "object",
			properties: {
				error: { type: "string" },
			},
		},
	},
};

const MAX_DELAY = 10; // Maximum delay in seconds

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const delayRoute = (fastify: FastifyInstance) => {
	const handler = async (request: DelayRequest, reply: FastifyReply) => {
		const delay = Number.parseFloat(request.params.delay);

		if (Number.isNaN(delay) || delay < 0) {
			return reply
				.code(400)
				.send({ error: "delay must be a non-negative number" });
		}

		// Cap delay at MAX_DELAY seconds
		const actualDelay = Math.min(delay, MAX_DELAY);
		await sleep(actualDelay * 1000);

		const { protocol } = request;
		const host = request.headers.host || "localhost";

		return {
			args: request.query || {},
			data: "",
			files: {},
			form: {},
			headers: request.headers,
			origin: request.ip,
			url: `${protocol}://${host}${request.url}`,
		};
	};

	fastify.get("/delay/:delay", { schema: delaySchema }, handler);
	fastify.post("/delay/:delay", { schema: delaySchema }, handler);
	fastify.put("/delay/:delay", { schema: delaySchema }, handler);
	fastify.patch("/delay/:delay", { schema: delaySchema }, handler);
	fastify.delete("/delay/:delay", { schema: delaySchema }, handler);
};
