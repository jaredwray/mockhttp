import {
	type FastifyInstance, type FastifyReply, type FastifyRequest, type FastifySchema,
} from 'fastify';

const parseBearer = (header?: string) => {
	if (!header) {
		return undefined;
	}

	const [scheme, token] = header.split(' ');
	if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
		return undefined;
	}

	return token;
};

export const bearerAuthSchema: FastifySchema = {
	description: 'HTTP Bearer authentication. Succeeds if any Bearer token is present unless ?required=true is provided.',
	tags: ['Auth'],
	querystring: {
		type: 'object',
		properties: {
			required: {type: 'boolean', default: true},
		},
	},
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: 'object',
			properties: {
				authenticated: {type: 'boolean'},
				token: {type: 'string'},
			},
			required: ['authenticated', 'token'],
		},
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		401: {
			type: 'object',
			properties: {message: {type: 'string'}},
			required: ['message'],
		},
	},
};

export const bearerAuthRoute = (fastify: FastifyInstance) => {
	fastify.get('/bearer', {schema: bearerAuthSchema}, async (request: FastifyRequest, reply: FastifyReply) => {
		const token = parseBearer(request.headers.authorization);
		const qs = request.query as {required?: boolean} | undefined;
		const required = qs?.required ?? true;

		if (!token && required) {
			void reply.header('WWW-Authenticate', 'Bearer');
			return reply.status(401).send({message: 'Unauthorized'});
		}

		if (!token) {
			return reply.send({authenticated: false, token: ''});
		}

		return reply.send({authenticated: true, token});
	});
};

export default bearerAuthRoute;
