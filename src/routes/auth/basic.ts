import {Buffer} from 'node:buffer';
import {
	type FastifyInstance, type FastifyReply, type FastifyRequest, type FastifySchema,
} from 'fastify';

type BasicAuthParameters = {
	user: string;
	passwd: string;
};

const parseBasic = (header?: string) => {
	if (!header) {
		return undefined;
	}

	const [scheme, value] = header.split(' ');
	if (!scheme || scheme.toLowerCase() !== 'basic' || !value) {
		return undefined;
	}

	try {
		const decoded = Buffer.from(value, 'base64').toString('utf8');
		const idx = decoded.indexOf(':');
		if (idx === -1) {
			return undefined;
		}

		return {username: decoded.slice(0, idx), password: decoded.slice(idx + 1)};
	} catch {
		/* c8 ignore next 2 */
		return undefined;
	}
};

export const basicAuthSchema: FastifySchema = {
	description: 'HTTP Basic authentication. Succeeds only if the user/pass provided in the path matches the Basic Authorization header.',
	tags: ['Auth'],
	params: {
		type: 'object',
		properties: {
			user: {type: 'string'},
			passwd: {type: 'string'},
		},
		required: ['user', 'passwd'],
	},
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: 'object',
			properties: {
				authenticated: {type: 'boolean'},
				user: {type: 'string'},
			},
			required: ['authenticated', 'user'],
		},
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		401: {
			type: 'object',
			properties: {
				message: {type: 'string'},
			},
			required: ['message'],
		},
	},
};

export const basicAuthRoute = (fastify: FastifyInstance) => {
	fastify.get('/basic-auth/:user/:passwd', {schema: basicAuthSchema}, async (request: FastifyRequest<{Params: BasicAuthParameters}>, reply: FastifyReply) => {
		const {user, passwd} = request.params;
		const parsed = parseBasic(request.headers.authorization);

		if (!parsed || parsed.username !== user || parsed.password !== passwd) {
			void reply.header('WWW-Authenticate', 'Basic realm="mockhttp"');
			return reply.status(401).send({message: 'Unauthorized'});
		}

		return reply.send({authenticated: true, user});
	});
};

export default basicAuthRoute;
