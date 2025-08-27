import type { FastifyInstance, FastifyRequest, FastifySchema } from "fastify";

const plainSchema: FastifySchema = {
	description: "Returns random plain text content",
	tags: ["Response Inspection"],
	// @ts-expect-error
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: "string",
			description: "Random plain text content",
		},
	},
};

const textSchema: FastifySchema = {
	description: "Returns random text content",
	tags: ["Response Inspection"],
	// @ts-expect-error
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: "string",
			description: "Random text content",
		},
	},
};

const randomTexts = [
	"The quick brown fox jumps over the lazy dog.",
	"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"To be or not to be, that is the question.",
	"All work and no play makes Jack a dull boy.",
	"The only way to do great work is to love what you do.",
	"In the beginning was the Word, and the Word was with God.",
	"Once upon a time in a galaxy far, far away...",
	"It was the best of times, it was the worst of times.",
	"The journey of a thousand miles begins with a single step.",
	"Knowledge is power. France is bacon.",
];

export const plainRoute = (fastify: FastifyInstance) => {
	// @ts-expect-error
	fastify.get(
		"/plain",
		{ schema: plainSchema },
		// biome-ignore lint/suspicious/noExplicitAny: reply
		async (_request: FastifyRequest, reply: any) => {
			const randomIndex = Math.floor(Math.random() * randomTexts.length);
			const text = randomTexts[randomIndex];

			reply.type("text/plain");
			return text;
		},
	);

	// @ts-expect-error
	fastify.get(
		"/text",
		{ schema: textSchema },
		// biome-ignore lint/suspicious/noExplicitAny: reply
		async (_request: FastifyRequest, reply: any) => {
			const randomIndex = Math.floor(Math.random() * randomTexts.length);
			const text = randomTexts[randomIndex];

			reply.type("text/plain");
			return text;
		},
	);
};
