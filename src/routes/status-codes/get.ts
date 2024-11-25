import {
	type FastifyInstance, type FastifyRequest, type FastifyReply, type FastifySchema,
} from 'fastify';

type StatusRequest = FastifyRequest<{Params: {code: string}}>;

const statusSchema: FastifySchema = {
	description: 'Returns a response with the provided status code',
	tags: ['Status Codes'],
	params: {
		type: 'object',
		properties: {
			code: {type: 'string', description: 'HTTP status code to be returned'},
		},
		required: ['code'],
	},
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: 'object',
			properties: {
				status: {type: 'string'},
			},
		},
	},
};

export const getStatusCodeRoute = (fastify: FastifyInstance) => {
	fastify.get('/status/:code', {schema: statusSchema}, async (request: StatusRequest, reply: FastifyReply) => {
		const {code} = request.params;
		await reply.code(Number(code));
		return {
			status: `Response with status code ${code}`,
		};
	});
};
