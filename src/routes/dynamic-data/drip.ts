import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

type DripRequest = FastifyRequest<{
	Querystring: {
		duration?: string;
		numbytes?: string;
		code?: string;
		delay?: string;
	};
}>;

const dripSchema: FastifySchema = {
	description:
		"Drips data over a duration after an optional initial delay, then (optionally) returns with the given status code",
	tags: ["Dynamic Data"],
	querystring: {
		type: "object",
		properties: {
			duration: {
				type: "string",
				description:
					"Duration in seconds over which to drip the data (default: 2)",
			},
			numbytes: {
				type: "string",
				description: "Number of bytes to send (default: 10)",
			},
			code: {
				type: "string",
				description: "HTTP status code to return (default: 200)",
			},
			delay: {
				type: "string",
				description: "Initial delay in seconds before starting (default: 2)",
			},
		},
	},
	response: {
		200: {
			type: "string",
			description: "Dripped data",
		},
		400: {
			type: "object",
			properties: {
				error: { type: "string" },
			},
		},
	},
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_DURATION = 2;
const DEFAULT_NUMBYTES = 10;
const DEFAULT_CODE = 200;
const DEFAULT_DELAY = 2;
const MAX_DURATION = 10;
const MAX_DELAY = 10;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB limit

export const dripRoute = (fastify: FastifyInstance) => {
	fastify.get(
		"/drip",
		{ schema: dripSchema },
		async (request: DripRequest, reply: FastifyReply) => {
			const duration = request.query.duration
				? Number.parseFloat(request.query.duration)
				: DEFAULT_DURATION;
			const numbytes = request.query.numbytes
				? Number.parseInt(request.query.numbytes, 10)
				: DEFAULT_NUMBYTES;
			const code = request.query.code
				? Number.parseInt(request.query.code, 10)
				: DEFAULT_CODE;
			const delay = request.query.delay
				? Number.parseFloat(request.query.delay)
				: DEFAULT_DELAY;

			// Validate parameters
			if (Number.isNaN(duration) || duration < 0) {
				return reply
					.code(400)
					.send({ error: "duration must be a non-negative number" });
			}
			if (Number.isNaN(numbytes) || numbytes < 0) {
				return reply
					.code(400)
					.send({ error: "numbytes must be a non-negative integer" });
			}
			if (Number.isNaN(code) || code < 100 || code > 599) {
				return reply
					.code(400)
					.send({ error: "code must be a valid HTTP status code" });
			}
			if (Number.isNaN(delay) || delay < 0) {
				return reply
					.code(400)
					.send({ error: "delay must be a non-negative number" });
			}

			// Apply limits
			const actualDuration = Math.min(duration, MAX_DURATION);
			const actualDelay = Math.min(delay, MAX_DELAY);
			const actualBytes = Math.min(numbytes, MAX_BYTES);

			// Initial delay
			if (actualDelay > 0) {
				await sleep(actualDelay * 1000);
			}

			// Set headers - NOT using chunked encoding (per httpbin spec)
			reply.raw.writeHead(code, {
				"Content-Type": "application/octet-stream",
				"Content-Length": actualBytes.toString(),
			});

			if (actualBytes === 0) {
				reply.raw.end();
				return;
			}

			// Calculate interval between bytes
			const intervalMs =
				actualBytes > 1 ? (actualDuration * 1000) / (actualBytes - 1) : 0;

			// Drip bytes one at a time
			const byte = Buffer.from("*");
			for (let i = 0; i < actualBytes; i++) {
				reply.raw.write(byte);
				if (i < actualBytes - 1 && intervalMs > 0) {
					await sleep(intervalMs);
				}
			}

			reply.raw.end();
		},
	);
};
