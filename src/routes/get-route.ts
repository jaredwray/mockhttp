import {
	type FastifyInstance, type FastifyRequest, type FastifyReply, type FastifySchema,
} from 'fastify';

export const getSchema: FastifySchema = {
	description: 'Returns request information for GET requests',
	querystring: {
		type: 'object',
		additionalProperties: true,
		properties: {},
		description: 'Query parameters sent in the request',
	},
	headers: {
		type: 'object',
		additionalProperties: true,
		properties: {},
		description: 'Headers sent in the request',
	},
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: 'object',
			properties: {
				method: {type: 'string'},
				headers: {type: 'object', additionalProperties: {type: 'string'}},
				queryParams: {type: 'object', additionalProperties: {type: 'string'}},
			},
			required: ['method', 'headers', 'queryParams'],
		},
	},
};

export const getRoute = (fastify: FastifyInstance) => {
	fastify.get('/get', {schema: getSchema}, async (request: FastifyRequest, _reply: FastifyReply) => ({
		method: 'GET',
		headers: request.headers,
		queryParams: request.query,
	}));
};
