import {type FastifyInstance, type FastifyRequest, type FastifySchema} from 'fastify';

const postSchema: FastifySchema = {
	description: 'Handles a POST request and returns request information',
	tags: ['HTTP Methods'],
	body: {
		type: 'object',
		additionalProperties: true,
		description: 'The body of the POST request',
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

export const postRoute = (fastify: FastifyInstance) => {
	fastify.post('/post', {schema: postSchema}, async (request: FastifyRequest) => ({
		method: 'POST',
		headers: request.headers,
		body: request.body,
	}));
};
