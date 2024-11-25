import {type FastifyInstance, type FastifyRequest, type FastifySchema} from 'fastify';

const putSchema: FastifySchema = {
	description: 'Handles a PUT request and returns request information',
	tags: ['HTTP Methods'],
	body: {
		type: 'object',
		additionalProperties: true,
		description: 'The body of the PUT request',
	},
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: 'object',
			properties: {
				method: {type: 'string'},
				headers: {type: 'object', additionalProperties: {type: 'string'}},
				body: {type: 'object', additionalProperties: true},
			},
			required: ['method', 'headers', 'body'],
		},
	},
};

export const putRoute = (fastify: FastifyInstance) => {
	fastify.put('/put', {schema: putSchema}, async (request: FastifyRequest) => ({
		method: 'PUT',
		headers: request.headers,
		body: request.body,
	}));
};
