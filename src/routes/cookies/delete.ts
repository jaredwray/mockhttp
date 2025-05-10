import {
	type FastifyInstance, type FastifySchema,
} from 'fastify';

export const cookiesDeleteSchema: FastifySchema = {
	description: 'Delete a cookie',
	tags: ['Cookies'],
	querystring: {
		type: 'object',
		properties: {
			name: {type: 'string'},
		},
		required: ['name'],
		additionalProperties: false,
	},
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		204: {
			type: 'null',
		},
	},
};

export const deleteCookieRoute = (fastify: FastifyInstance) => {
	fastify.delete('/cookies', async (request, reply) => {
		const {name} = request.query as {name: string};
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		reply.clearCookie(name, {path: '/'});

		// Send back a 204 No Content response
		return reply.status(204).send();
	});
};
