import {type FastifyInstance, type FastifyRequest, type FastifySchema} from 'fastify';
import {type FastifyReply} from 'fastify/types/reply';

const absoluteRedirectSchema: FastifySchema = {
	tags: ['Redirects'],
	description: 'Redirects the request to the target URL using an absolute URL',
	params: {
		type: 'object',
		properties: {
			value: {type: 'integer', minimum: 1}, // Ensure value is a positive integer
		},
		required: ['value'],
	},
	headers: {
		type: 'object',
		properties: {
			host: {type: 'string'}, // Ensure the `host` header is a string
		},
		required: ['host'],
	},
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		302: {
			type: 'string', // The response is an HTML string
		},
	},
};

export const absoluteRedirectRoute = (fastify: FastifyInstance) => {
	fastify.get<{Params: {value: number}}>('/absolute-redirect/:value', {schema: absoluteRedirectSchema}, async (request: FastifyRequest, reply: FastifyReply) => {
		const {value} = (request.params as {value: number});
		const {host} = request.headers;
		const {protocol} = request;
		let url = `${protocol}://${host}/get`;
		let html = `
        <title>Redirecting...</title>
        <h1>Redirecting...</h1>
        <p>You should be redirected automatically to target URL: <a href="${url}">${url}</a>.  If not click the link.</p>
        `;

		if (value > 1) {
			url = `${protocol}://${host}/absolute-redirect/${value - 1}`;
			html = `
            <title>Redirecting...</title>
            <h1>Redirecting...</h1>
            <p>You should be redirected automatically to target URL: <a href="${url}">${url}</a>.  If not click the link.</p>
            `;
		}

		await reply.header('Location', url).status(302).type('text/html').send(html);
	});
};
