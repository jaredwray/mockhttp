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
		unbuffered?: string;
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
			unbuffered: {
				type: "string",
				description:
					"When 'true' or '1', sets the X-Accel-Buffering: no response header, asking any buffering reverse proxy in front of this server (e.g. Cloudflare, nginx) to stream bytes through as they're written instead of holding the full response until it's complete. Off by default since it has no effect running directly against this server and is only useful when deployed behind such a proxy.",
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
			/* v8 ignore next 2 -- @preserve */
			const duration = request.query.duration
				? Number.parseFloat(request.query.duration)
				: DEFAULT_DURATION;
			const numbytes = request.query.numbytes
				? Number.parseInt(request.query.numbytes, 10)
				: DEFAULT_NUMBYTES;
			/* v8 ignore next 2 -- @preserve */
			const code = request.query.code
				? Number.parseInt(request.query.code, 10)
				: DEFAULT_CODE;
			/* v8 ignore next 3 -- @preserve */
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
			const headers: Record<string, string> = {
				"Content-Type": "application/octet-stream",
				"Content-Length": actualBytes.toString(),
			};
			// A reverse proxy sitting in front of this server (this is how
			// mockhttp.org itself is deployed - see the "Cloudflare" section of
			// the README) may buffer the whole response before forwarding it,
			// which defeats the entire point of "drip"-ing bytes over time.
			// X-Accel-Buffering: no is a de facto standard (originally an
			// nginx directive, also honored by Cloudflare) for asking a proxy
			// to pass bytes through as written instead of buffering them.
			if (
				request.query.unbuffered === "true" ||
				request.query.unbuffered === "1"
			) {
				headers["X-Accel-Buffering"] = "no";
			}
			reply.raw.writeHead(code, headers);

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
