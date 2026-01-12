import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

type RangeRequest = FastifyRequest<{
	Params: { numbytes: string };
	Querystring: { duration?: string; chunk_size?: string };
}>;

const rangeSchema: FastifySchema = {
	description:
		"Streams n random bytes generated, and supports HTTP Range requests",
	tags: ["Dynamic Data"],
	params: {
		type: "object",
		properties: {
			numbytes: {
				type: "string",
				description: "Number of bytes available",
			},
		},
		required: ["numbytes"],
	},
	querystring: {
		type: "object",
		properties: {
			duration: {
				type: "string",
				description: "Delay before sending response in seconds",
			},
			chunk_size: {
				type: "string",
				description: "Size of each chunk",
			},
		},
	},
	response: {
		200: {
			type: "string",
			description: "Binary data",
		},
		206: {
			type: "string",
			description: "Partial binary data",
		},
		400: {
			type: "object",
			properties: {
				error: { type: "string" },
			},
		},
		416: {
			type: "object",
			properties: {
				error: { type: "string" },
			},
		},
	},
};

const MAX_BYTES = 100 * 1024; // 100KB limit

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generate deterministic bytes (alphabet pattern like httpbin)
function generateBytes(n: number): Buffer {
	const alphabet = "abcdefghijklmnopqrstuvwxyz";
	const bytes = Buffer.alloc(n);
	for (let i = 0; i < n; i++) {
		bytes[i] = alphabet.charCodeAt(i % alphabet.length);
	}
	return bytes;
}

interface Range {
	start: number;
	end: number;
}

function parseRangeHeader(
	rangeHeader: string,
	totalSize: number,
): Range[] | null {
	const match = rangeHeader.match(/^bytes=(.+)$/);
	if (!match) return null;

	const ranges: Range[] = [];
	const parts = match[1].split(",");

	for (const part of parts) {
		const trimmedPart = part.trim();

		if (trimmedPart.startsWith("-")) {
			// Suffix range: -500 means last 500 bytes
			const suffix = Number.parseInt(trimmedPart.slice(1), 10);
			/* v8 ignore next -- @preserve */
			if (Number.isNaN(suffix)) return null;
			ranges.push({
				start: Math.max(0, totalSize - suffix),
				end: totalSize - 1,
			});
		} else if (trimmedPart.endsWith("-")) {
			// Open-ended range: 500- means from byte 500 to end
			const start = Number.parseInt(trimmedPart.slice(0, -1), 10);
			/* v8 ignore next -- @preserve */
			if (Number.isNaN(start)) return null;
			ranges.push({ start, end: totalSize - 1 });
		} else {
			// Normal range: 0-499
			const [startStr, endStr] = trimmedPart.split("-");
			const start = Number.parseInt(startStr, 10);
			const end = Number.parseInt(endStr, 10);
			/* v8 ignore next -- @preserve */
			if (Number.isNaN(start) || Number.isNaN(end)) return null;
			ranges.push({ start, end: Math.min(end, totalSize - 1) });
		}
	}

	// Validate ranges
	for (const range of ranges) {
		if (range.start > range.end || range.start >= totalSize) {
			return null;
		}
	}

	return ranges;
}

export const rangeRoute = (fastify: FastifyInstance) => {
	fastify.get(
		"/range/:numbytes",
		{ schema: rangeSchema },
		async (request: RangeRequest, reply: FastifyReply) => {
			const numbytes = Number.parseInt(request.params.numbytes, 10);

			if (Number.isNaN(numbytes) || numbytes < 0) {
				return reply
					.code(400)
					.send({ error: "numbytes must be a non-negative integer" });
			}

			const limitedBytes = Math.min(numbytes, MAX_BYTES);

			// Handle duration parameter
			if (request.query.duration) {
				const duration = Number.parseFloat(request.query.duration);
				if (!Number.isNaN(duration) && duration > 0) {
					await sleep(Math.min(duration, 10) * 1000);
				}
			}

			const allBytes = generateBytes(limitedBytes);
			const rangeHeader = request.headers.range;

			// If no Range header, return full content
			if (!rangeHeader) {
				return reply
					.header("Content-Type", "application/octet-stream")
					.header("Content-Length", allBytes.length)
					.header("Accept-Ranges", "bytes")
					.send(allBytes);
			}

			// Parse Range header
			const ranges = parseRangeHeader(rangeHeader, limitedBytes);

			if (!ranges || ranges.length === 0) {
				return reply
					.code(416)
					.header("Content-Range", `bytes */${limitedBytes}`)
					.send({ error: "Range Not Satisfiable" });
			}

			// Single range
			if (ranges.length === 1) {
				const range = ranges[0];
				const chunk = allBytes.subarray(range.start, range.end + 1);

				return reply
					.code(206)
					.header("Content-Type", "application/octet-stream")
					.header("Content-Length", chunk.length)
					.header("Accept-Ranges", "bytes")
					.header(
						"Content-Range",
						`bytes ${range.start}-${range.end}/${limitedBytes}`,
					)
					.send(chunk);
			}

			// Multiple ranges - return multipart response
			const boundary = "3d6b6a416f9b5";
			const parts: Buffer[] = [];

			for (const range of ranges) {
				const chunk = allBytes.subarray(range.start, range.end + 1);
				const header = `\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\nContent-Range: bytes ${range.start}-${range.end}/${limitedBytes}\r\n\r\n`;
				parts.push(Buffer.from(header));
				parts.push(chunk);
			}

			parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

			const multipartBody = Buffer.concat(parts);

			return reply
				.code(206)
				.header("Content-Type", `multipart/byteranges; boundary=${boundary}`)
				.header("Content-Length", multipartBody.length)
				.send(multipartBody);
		},
	);
};
