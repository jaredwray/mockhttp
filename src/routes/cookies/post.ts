import {
	type FastifyInstance, type FastifySchema,
} from 'fastify';

const postCookieRouteSchema: FastifySchema = {
	description: 'Set a cookie',
	tags: ['Cookies'],
	body: {
		type: 'object',
		properties: {
			name: {type: 'string'},
			value: {type: 'string'},
			expires: {type: 'string', format: 'date-time'},
		},
		required: ['name', 'value'],
		additionalProperties: false,
	},
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

export const postCookieRoute = (fastify: FastifyInstance) => {
	fastify.post<{Body: {name: string; value: string; expires?: string}}>('/cookies', {schema: postCookieRouteSchema}, async (request, reply) => {
		const {name, value, expires} = request.body;
		if (expires) {
			const date = new Date(expires);
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			reply.setCookie(name, value, {path: '/', expires: date});
		} else {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			reply.setCookie(name, value, {path: '/'});
		}

		// Send back the current cookies
		return reply.send({cookies: request.cookies});
	});
};
