import {
	type FastifyInstance, type FastifyRequest, type FastifyReply, type FastifySchema,
} from 'fastify';

const cookiesSchema: FastifySchema = {
	description: 'Return cookies from the request',
	tags: ['Cookies'],
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: 'object',
			properties: {
				cookies: {
					type: 'object',
					additionalProperties: { type: 'string' },
				},
			},
			required: ['cookies'],
		},
	},
};

const cookiesPostSchema: FastifySchema = {
	description: 'Set a cookie',
	tags: ['Cookies'],
	body: {
		type: 'object',
		properties: {
			name: { type: 'string' },
			value: { type: 'string' },
			expires: { type: 'string', format: 'date-time' }
		},
		required: ['name', 'value'],
		additionalProperties: false
	},
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: 'object',
			properties: {
				cookies: {
					type: 'object',
					additionalProperties: { type: 'string' }
				}
			},
			required: ['cookies']
		}
	}
};

export const cookiesRoute = (fastify: FastifyInstance) => {
	fastify.get('/cookies', { schema: cookiesSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
		await reply.send({
			cookies: request.cookies,
		});
	});

	fastify.post<{ Body: { name: string; value: string; expires?: string } }>('/cookies', { schema: cookiesPostSchema }, async (request, reply) => {
		const { name, value, expires } = request.body;
		if (expires) {
			const date = new Date(expires)
			if (isNaN(date.getTime())) {
				return reply.status(400).send({ error: 'Invalid date format' })
			}
			reply.setCookie(name, value, { path: '/', expires: date })
		} else {
			reply.setCookie(name, value, { path: '/' })
		}

		// send back the current cookies
		return reply.send({ cookies: request.cookies })
	}
	);
};
