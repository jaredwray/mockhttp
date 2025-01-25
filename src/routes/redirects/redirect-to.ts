import {
	type FastifyInstance, type FastifyRequest, type FastifyReply, type FastifySchema,
} from 'fastify';

type RedirectToRequest = FastifyRequest<{Querystring: {url: string; status_code?: string}}>;

export const redirectToSchema: FastifySchema = {
	tags: ['Redirects'],
	description: 'Redirects the request to the target URL',
	querystring: {
		type: 'object',
		properties: {
			url: {type: 'string', format: 'uri', description: 'The URL to redirect to'},
			// eslint-disable-next-line  @typescript-eslint/naming-convention
			status_code: {
				type: 'string',
				pattern: '^[1-5][0-9][0-9]$', // Matches a 3-digit HTTP status code
				description: 'The HTTP status code to use for redirection',
			},
		},
		required: ['url'], // 'url' is required
		additionalProperties: false,
	},
};

export const redirectToRoute = (fastify: FastifyInstance) => {
	const handler = async (request: RedirectToRequest, reply: FastifyReply) => {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		const {url, status_code} = request.query;
		const statusCode = status_code ? Number(status_code) : 302;

		await reply.redirect(url, statusCode);
	};

	fastify.get('/redirect-to', {schema: redirectToSchema}, handler);
	fastify.post('/redirect-to', {schema: redirectToSchema}, handler);
	fastify.put('/redirect-to', {schema: redirectToSchema}, handler);
	fastify.patch('/redirect-to', {schema: redirectToSchema}, handler);
	fastify.delete('/redirect-to', {schema: redirectToSchema}, handler);
};
