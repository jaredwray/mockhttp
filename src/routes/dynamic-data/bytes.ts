import { randomBytes } from "node:crypto";
import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

type BytesRequest = FastifyRequest<{
	Params: { n: string };
	Querystring: { seed?: string };
}>;

const bytesSchema: FastifySchema = {
	description: "Returns n random bytes generated with given seed",
	tags: ["Dynamic Data"],
	params: {
		type: "object",
		properties: {
			n: { type: "string", description: "Number of bytes to generate" },
		},
		required: ["n"],
	},
	querystring: {
		type: "object",
		properties: {
			seed: {
				type: "string",
				description: "Seed for random number generation",
			},
		},
	},
	response: {
		200: {
			type: "string",
			description: "Random binary data",
		},
		400: {
			type: "object",
			properties: {
				error: { type: "string" },
			},
		},
	},
};

// Simple seeded random number generator (LCG)
function seededRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		return state / 0x7fffffff;
	};
}

function generateSeededBytes(n: number, seed: number): Buffer {
	const random = seededRandom(seed);
	const bytes = Buffer.alloc(n);
	for (let i = 0; i < n; i++) {
		bytes[i] = Math.floor(random() * 256);
	}
	return bytes;
}

const MAX_BYTES = 100 * 1024; // 100KB limit

export const bytesRoute = (fastify: FastifyInstance) => {
	fastify.get(
		"/bytes/:n",
		{ schema: bytesSchema },
		async (request: BytesRequest, reply: FastifyReply) => {
			const n = Number.parseInt(request.params.n, 10);

			if (Number.isNaN(n) || n < 0) {
				return reply
					.code(400)
					.send({ error: "n must be a non-negative integer" });
			}

			const limitedN = Math.min(n, MAX_BYTES);
			const seedParam = request.query.seed;

			let bytes: Buffer;
			if (seedParam !== undefined) {
				const seed = Number.parseInt(seedParam, 10);
				if (Number.isNaN(seed)) {
					return reply.code(400).send({ error: "seed must be an integer" });
				}
				bytes = generateSeededBytes(limitedN, seed);
			} else {
				bytes = randomBytes(limitedN);
			}

			return reply
				.header("Content-Type", "application/octet-stream")
				.header("Content-Length", bytes.length)
				.send(bytes);
		},
	);
};
