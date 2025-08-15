import crypto from 'node:crypto';
import {
	type FastifyInstance, type FastifyReply, type FastifyRequest, type FastifySchema,
} from 'fastify';

// Minimal Digest auth implementation compatible with httpbin behavior for a single realm and algorithm MD5
// Path: /digest-auth/:qop/:user/:passwd[/:algorithm][/:stale_after]
// We implement qop values: auth, auth-int (treated same as auth), and optional algorithm md5, sha-256, sha-512
// Note: For simplicity and to avoid storing nonce states, we generate a fresh nonce per challenge and accept any provided response as long as it matches.

type DigestParameters = {
	qop: string;
	user: string;
	passwd: string;
	algorithm?: string;

	stale_after?: string;
};

const makeNonce = () => crypto.randomBytes(16).toString('hex');

const algorithms = new Set(['MD5', 'md5', 'SHA-256', 'sha-256', 'SHA-512', 'sha-512']);

export const hashAlg = (alg: string | undefined) => {
	if (!alg) {
		return 'md5';
	}

	const a = alg.toLowerCase();
	if (a === 'md5') {
		return 'md5';
	}

	if (a === 'sha-256') {
		return 'sha256';
	}

	if (a === 'sha-512') {
		return 'sha512';
	}

	return 'md5';
};

const h = (algo: string, data: string) => crypto.createHash(algo).update(data).digest('hex');

const parseDigest = (header?: string): Record<string, string> | undefined => {
	if (!header) {
		return undefined;
	}

	const [scheme, rest] = header.split(' ', 2);
	if (!scheme || scheme.toLowerCase() !== 'digest' || !rest) {
		return undefined;
	}

	const out: Record<string, string> = {};
	// Split on comma not inside quotes
	const parts = rest.match(/\w+\s*=\s*("[^"]*"|[^,]+)/g);
	if (!parts) {
		return out;
	}

	for (const p of parts) {
		const [k, v] = p.split('=');
		out[k.trim()] = v.trim().replaceAll(/^"|"$/g, '');
	}

	return out;
};

export const digestAuthSchema: FastifySchema = {
	description: 'HTTP Digest authentication. Mirrors httpbin behavior for testing clients.',
	tags: ['Auth'],
	params: {
		type: 'object',
		properties: {
			qop: {type: 'string'},
			user: {type: 'string'},
			passwd: {type: 'string'},
			algorithm: {type: 'string'},
			// eslint-disable-next-line @typescript-eslint/naming-convention
			stale_after: {type: 'string'},
		},
		required: ['qop', 'user', 'passwd'],
	},
};

export const digestAuthRoute = (fastify: FastifyInstance) => {
	fastify.get('/digest-auth/:qop/:user/:passwd', {schema: digestAuthSchema}, async (request: FastifyRequest<{Params: DigestParameters}>, reply: FastifyReply) => {
		const {user, passwd} = request.params;
		const realm = 'mockhttp';
		const nonce = makeNonce();

		const auth = parseDigest(request.headers.authorization);

		if (!auth) {
			void reply.header('WWW-Authenticate', `Digest realm="${realm}", qop="auth,auth-int", nonce="${nonce}", opaque="${makeNonce()}"`);
			return reply.status(401).send({message: 'Unauthorized'});
		}

		// Validate username
		if (auth.username !== user) {
			void reply.header('WWW-Authenticate', `Digest realm="${realm}", qop="auth,auth-int", nonce="${nonce}", opaque="${makeNonce()}"`);
			return reply.status(401).send({message: 'Unauthorized'});
		}

		// Compute expected response
		const method = 'GET';
		const uri = auth.uri ?? request.url.replace(/^https?:\/\/[^/]+/, '');
		const algo = hashAlg(auth.algorithm);
		const ha1 = h(algo, `${user}:${realm}:${passwd}`);
		const ha2 = h(algo, `${method}:${uri}`);

		let expected = '';
		expected = auth.qop ? h(algo, `${ha1}:${auth.nonce}:${auth.nc}:${auth.cnonce}:${auth.qop}:${ha2}`) : h(algo, `${ha1}:${auth.nonce}:${ha2}`);

		if (!auth.response || auth.response !== expected) {
			void reply.header('WWW-Authenticate', `Digest realm="${realm}", qop="auth,auth-int", nonce="${nonce}", opaque="${makeNonce()}"`);
			return reply.status(401).send({message: 'Unauthorized'});
		}

		return reply.send({authenticated: true, user});
	});

	// Optional algorithm
	fastify.get('/digest-auth/:qop/:user/:passwd/:algorithm', {schema: digestAuthSchema}, async (request: FastifyRequest<{Params: DigestParameters}>, reply: FastifyReply) => {
		const {user, passwd, algorithm} = request.params;
		const realm = 'mockhttp';
		const algoHeader = algorithms.has(String(algorithm)) ? String(algorithm) : 'MD5';
		const nonce = makeNonce();

		const auth = parseDigest(request.headers.authorization);

		if (!auth) {
			void reply.header('WWW-Authenticate', `Digest realm="${realm}", qop="auth,auth-int", algorithm=${algoHeader}, nonce="${nonce}", opaque="${makeNonce()}"`);
			return reply.status(401).send({message: 'Unauthorized'});
		}

		if (auth.username !== user) {
			void reply.header('WWW-Authenticate', `Digest realm="${realm}", qop="auth,auth-int", algorithm=${algoHeader}, nonce="${nonce}", opaque="${makeNonce()}"`);
			return reply.status(401).send({message: 'Unauthorized'});
		}

		/* c8 ignore next 2 */
		const method = 'GET';
		const uri = auth.uri ?? request.url.replace(/^https?:\/\/[^/]+/, '');
		const algo = hashAlg(auth.algorithm ?? algoHeader);
		const ha1 = h(algo, `${user}:${realm}:${passwd}`);
		const ha2 = h(algo, `${method}:${uri}`);

		const expected = auth.qop
			? h(algo, `${ha1}:${auth.nonce}:${auth.nc}:${auth.cnonce}:${auth.qop}:${ha2}`)
			: h(algo, `${ha1}:${auth.nonce}:${ha2}`);

		if (!auth.response || auth.response !== expected) {
			void reply.header('WWW-Authenticate', `Digest realm="${realm}", qop="auth,auth-int", algorithm=${algoHeader}, nonce="${nonce}", opaque="${makeNonce()}"`);
			return reply.status(401).send({message: 'Unauthorized'});
		}

		return reply.send({authenticated: true, user});
	});
};

export default digestAuthRoute;
