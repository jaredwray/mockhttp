import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

const imageSchema: FastifySchema = {
	description:
		"Returns an image based on Accept header (supports jpeg, png, svg, webp)",
	tags: ["Images"],
	headers: {
		type: "object",
		properties: {
			accept: {
				type: "string",
				description: "Accept header for content negotiation",
			},
		},
	},
	response: {
		200: {
			description: "Image file",
			type: "string",
			format: "binary",
		},
	},
};

const jpegSchema: FastifySchema = {
	description: "Returns a JPEG image",
	tags: ["Images"],
	response: {
		200: {
			description: "JPEG image",
			type: "string",
			format: "binary",
		},
	},
};

const pngSchema: FastifySchema = {
	description: "Returns a PNG image",
	tags: ["Images"],
	response: {
		200: {
			description: "PNG image",
			type: "string",
			format: "binary",
		},
	},
};

const svgSchema: FastifySchema = {
	description: "Returns an SVG image",
	tags: ["Images"],
	response: {
		200: {
			description: "SVG image",
			type: "string",
			format: "binary",
		},
	},
};

const webpSchema: FastifySchema = {
	description: "Returns a WEBP image",
	tags: ["Images"],
	response: {
		200: {
			description: "WEBP image",
			type: "string",
			format: "binary",
		},
	},
};

export const imageRoutes = (fastify: FastifyInstance) => {
	const publicPath = join(process.cwd(), "public");

	// Content negotiation route
	fastify.get(
		"/image",
		{ schema: imageSchema },
		async (request: FastifyRequest, reply: FastifyReply) => {
			const accept = request.headers.accept || "";

			let file = "logo.png";
			let contentType = "image/png";

			if (accept.includes("image/jpeg") || accept.includes("image/jpg")) {
				file = "logo.jpg";
				contentType = "image/jpeg";
			} else if (
				accept.includes("image/svg+xml") ||
				accept.includes("image/svg")
			) {
				file = "logo.svg";
				contentType = "image/svg+xml";
			} else if (accept.includes("image/webp")) {
				file = "logo.webp";
				contentType = "image/webp";
			} else if (accept.includes("image/png")) {
				file = "logo.png";
				contentType = "image/png";
			}

			try {
				const imagePath = join(publicPath, file);
				const imageBuffer = readFileSync(imagePath);

				reply.type(contentType);
				return imageBuffer;
			} catch (error) {
				/* v8 ignore next -- @preserve */
				reply.code(500);
				/* v8 ignore next -- @preserve */
				return { error: `${error}` };
			}
		},
	);

	// JPEG specific route
	fastify.get(
		"/image/jpeg",
		{ schema: jpegSchema },
		async (_request: FastifyRequest, reply: FastifyReply) => {
			try {
				const imagePath = join(publicPath, "logo.jpg");
				const imageBuffer = readFileSync(imagePath);
				reply.type("image/jpeg");
				return imageBuffer;
			} catch (error) {
				/* v8 ignore next -- @preserve */
				reply.code(500);
				/* v8 ignore next -- @preserve */
				return { error: `${error}` };
			}
		},
	);

	// PNG specific route
	fastify.get(
		"/image/png",
		{ schema: pngSchema },
		async (_request: FastifyRequest, reply: FastifyReply) => {
			try {
				const imagePath = join(publicPath, "logo.png");
				const imageBuffer = readFileSync(imagePath);
				reply.type("image/png");
				return imageBuffer;
			} catch (error) {
				/* v8 ignore next -- @preserve */
				reply.code(500);
				/* v8 ignore next -- @preserve */
				return { error: `${error}` };
			}
		},
	);

	// SVG specific route
	fastify.get(
		"/image/svg",
		{ schema: svgSchema },
		async (_request: FastifyRequest, reply: FastifyReply) => {
			try {
				const imagePath = join(publicPath, "logo.svg");
				const imageBuffer = readFileSync(imagePath);
				reply.type("image/svg+xml");
				return imageBuffer;
			} catch (error) {
				/* v8 ignore next -- @preserve */
				reply.code(500);
				/* v8 ignore next -- @preserve */
				return { error: `${error}` };
			}
		},
	);

	// WEBP specific route
	fastify.get(
		"/image/webp",
		{ schema: webpSchema },
		async (_request: FastifyRequest, reply: FastifyReply) => {
			try {
				const imagePath = join(publicPath, "logo.webp");
				const imageBuffer = readFileSync(imagePath);
				reply.type("image/webp");
				return imageBuffer;
			} catch (error) {
				/* v8 ignore next -- @preserve */
				reply.code(500);
				/* v8 ignore next -- @preserve */
				return { error: `${error}` };
			}
		},
	);
};
