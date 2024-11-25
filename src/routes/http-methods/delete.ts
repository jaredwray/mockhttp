import {type FastifyInstance, type FastifyRequest, type FastifySchema} from 'fastify';

const deleteSchema: FastifySchema = {
	description: 'Handles a DELETE request and returns request information',
	tags: ['HTTP Methods'],
	body: {
		type: 'object',
		additionalProperties: true,
		description: 'The body of the DELETE request',
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

export const deleteRoute = (fastify: FastifyInstance) => {
	fastify.delete('/delete', {schema: deleteSchema}, async (request: FastifyRequest) => ({
		method: 'DELETE',
		headers: request.headers,
		body: request.body,
	}));
};
