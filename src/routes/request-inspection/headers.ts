import {type FastifyInstance, type FastifyRequest, type FastifySchema} from 'fastify';

const headersSchema: FastifySchema = {
	description: 'Returns all headers of the client request',
	tags: ['Request Inspection'],
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: 'object',
			properties: {
				headers: {
					type: 'object',
					additionalProperties: {type: 'string'},
					description: 'All headers of the client request',
				},
			},
			required: ['headers'],
		},
	},
};

export const headersRoute = (fastify: FastifyInstance) => {
	fastify.get('/headers', {schema: headersSchema}, async (request: FastifyRequest) => {
		const headers = request.headers;

		return {
			headers,
		};
	});
};
