import {type FastifyInstance, type FastifyRequest, type FastifySchema} from 'fastify';
import {escape} from 'html-escaper';

const responseHeadersSchema: FastifySchema = {
	description: 'Returns a set of response headers based on the query string.',
	tags: ['Response Inspection'],
	querystring: {
		type: 'object',
		additionalProperties: true,
		description: 'Freeform query string parameters to be added as response headers.',
	},
	response: {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		200: {
			type: 'object',
			additionalProperties: true,
			description: 'Response headers as per query string parameters.',
		},
	},
};

export const responseHeadersRoutes = (fastify: FastifyInstance) => {
	fastify.get('/response-headers', {schema: responseHeadersSchema}, async (request: FastifyRequest, reply) => {
		const queryParameters = request.query as Record<string, string>;

		for (const [key, value] of Object.entries(queryParameters)) {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			reply.header(key, escape(value));
		}

		const cleanedResponse = Object.fromEntries(
			Object.entries(queryParameters).map(([key, value]) => [key, escape(value)]),
		);

		await reply.send(cleanedResponse);
	});

	fastify.post('/response-headers', {schema: responseHeadersSchema}, async (request: FastifyRequest, reply) => {
		const queryParameters = (request.query ?? {}) as Record<string, string>;
		const body = (request.body ?? {}) as Record<string, string>;

		for (const [key, value] of Object.entries(queryParameters)) {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			reply.header(key, escape(value));
		}

		for (const [key, value] of Object.entries(body)) {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			reply.header(key, escape(value));
		}

		const cleanedResponse = Object.fromEntries(
			Object.entries({...queryParameters, ...body}).map(([key, value]) => [key, escape(value)]),
		);

		await reply.send(cleanedResponse);
	});
};
