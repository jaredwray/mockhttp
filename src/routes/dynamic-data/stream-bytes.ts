import { randomBytes } from "node:crypto";
import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

type StreamBytesRequest = FastifyRequest<{
	Params: { n: string };
	Querystring: { seed?: string; chunk_size?: string };
}>;

const streamBytesSchema: FastifySchema = {
	description:
		"Streams n random bytes generated with given seed, in chunks of chunk_size per packet",
	tags: ["Dynamic Data"],
	params: {
		type: "object",
		properties: {
			n: { type: "string", description: "Number of bytes to stream" },
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
			chunk_size: {
				type: "string",
				description: "Size of each chunk (default: 10240)",
			},
		},
	},
	response: {
		200: {
			type: "string",
			description: "Streamed random binary data",
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
const DEFAULT_CHUNK_SIZE = 10240;

export const streamBytesRoute = (fastify: FastifyInstance) => {
	fastify.get(
		"/stream-bytes/:n",
		{ schema: streamBytesSchema },
		async (request: StreamBytesRequest, reply: FastifyReply) => {
			const n = Number.parseInt(request.params.n, 10);

			if (Number.isNaN(n) || n < 0) {
				return reply
					.code(400)
					.send({ error: "n must be a non-negative integer" });
			}

			const limitedN = Math.min(n, MAX_BYTES);
			const chunkSize = request.query.chunk_size
				? Number.parseInt(request.query.chunk_size, 10)
				: DEFAULT_CHUNK_SIZE;

			if (Number.isNaN(chunkSize) || chunkSize <= 0) {
				return reply
					.code(400)
					.send({ error: "chunk_size must be a positive integer" });
			}

			const seedParam = request.query.seed;
			let allBytes: Buffer;

			if (seedParam !== undefined) {
				const seed = Number.parseInt(seedParam, 10);
				if (Number.isNaN(seed)) {
					return reply.code(400).send({ error: "seed must be an integer" });
				}
				allBytes = generateSeededBytes(limitedN, seed);
			} else {
				allBytes = randomBytes(limitedN);
			}

			// Set headers for chunked transfer encoding
			reply.raw.writeHead(200, {
				"Content-Type": "application/octet-stream",
				"Transfer-Encoding": "chunked",
			});

			// Stream bytes in chunks
			let offset = 0;
			while (offset < allBytes.length) {
				const chunk = allBytes.subarray(offset, offset + chunkSize);
				reply.raw.write(chunk);
				offset += chunkSize;
			}

			reply.raw.end();
		},
	);
};
