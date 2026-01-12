import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

type StreamRequest = FastifyRequest<{
	Params: { n: string };
}>;

const streamSchema: FastifySchema = {
	description: "Stream n JSON responses",
	tags: ["Dynamic Data"],
	params: {
		type: "object",
		properties: {
			n: {
				type: "string",
				description: "Number of JSON responses to stream (max 100)",
			},
		},
		required: ["n"],
	},
	response: {
		200: {
			type: "string",
			description: "Newline-delimited JSON responses",
		},
		400: {
			type: "object",
			properties: {
				error: { type: "string" },
			},
		},
	},
};

const MAX_LINES = 100;

export const streamRoute = (fastify: FastifyInstance) => {
	fastify.get(
		"/stream/:n",
		{ schema: streamSchema },
		async (request: StreamRequest, reply: FastifyReply) => {
			const n = Number.parseInt(request.params.n, 10);

			if (Number.isNaN(n) || n < 0) {
				return reply
					.code(400)
					.send({ error: "n must be a non-negative integer" });
			}

			const lines = Math.min(n, MAX_LINES);
			const { protocol } = request;
			const host = request.headers.host || "localhost";

			// Set headers for streaming JSON
			reply.raw.writeHead(200, {
				"Content-Type": "application/json",
				"Transfer-Encoding": "chunked",
			});

			// Stream JSON lines
			for (let i = 0; i < lines; i++) {
				const data = {
					id: i,
					args: request.query || {},
					headers: request.headers,
					origin: request.ip,
					url: `${protocol}://${host}${request.url}`,
				};
				reply.raw.write(`${JSON.stringify(data)}\n`);
			}

			reply.raw.end();
		},
	);
};
