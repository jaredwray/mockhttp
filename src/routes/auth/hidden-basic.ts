import {Buffer} from 'node:buffer';
import {
	type FastifyInstance, type FastifyReply, type FastifyRequest, type FastifySchema,
} from 'fastify';

type HiddenBasicParameters = {
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

export const hiddenBasicAuthSchema: FastifySchema = {
	description: 'HTTP Basic authentication with docs hidden. Mirrors /basic-auth but hides from schema.',
	tags: ['Auth'],
	hide: true,
	params: {
		type: 'object',
		properties: {
			user: {type: 'string'},
			passwd: {type: 'string'},
		},
		required: ['user', 'passwd'],
	},
};

export const hiddenBasicAuthRoute = (fastify: FastifyInstance) => {
	fastify.get('/hidden-basic-auth/:user/:passwd', {schema: hiddenBasicAuthSchema}, async (request: FastifyRequest<{Params: HiddenBasicParameters}>, reply: FastifyReply) => {
		const {user, passwd} = request.params;
		const parsed = parseBasic(request.headers.authorization);

		if (!parsed || parsed.username !== user || parsed.password !== passwd) {
			void reply.header('WWW-Authenticate', 'Basic realm="mockhttp"');
			return reply.status(401).send({message: 'Unauthorized'});
		}

		return reply.send({authenticated: true, user});
	});
};

export default hiddenBasicAuthRoute;
