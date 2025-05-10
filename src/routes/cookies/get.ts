import {
	type FastifyInstance, type FastifyRequest, type FastifyReply, type FastifySchema,
} from 'fastify';

const getCookiesRouteSchema: FastifySchema = {
	description: 'Return cookies from the request',
	tags: ['Cookies'],
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: 'object',
			properties: {
				cookies: {
					type: 'object',
					additionalProperties: {type: 'string'},
				},
			},
			required: ['cookies'],
		},
	},
};

export const getCookiesRoute = (fastify: FastifyInstance) => {
	fastify.get('/cookies', {schema: getCookiesRouteSchema}, async (request: FastifyRequest, reply: FastifyReply) => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		reply.type('application/json');
		await reply.send({
			cookies: request.cookies,
		});
	});
};
