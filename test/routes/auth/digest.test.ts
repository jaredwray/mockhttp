import crypto from 'node:crypto';
import {describe, it, expect} from 'vitest';
import Fastify from 'fastify';
import {digestAuthRoute} from '../../../src/routes/auth/digest.js';

describe('GET /digest-auth', () => {
	it('401 challenge on first request', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);
		const response = await fastify.inject({method: 'GET', url: '/digest-auth/auth/user/pass'});
		expect(response.statusCode).toBe(401);
		expect(response.headers['www-authenticate']).toMatch(/Digest/);
	});

	it('401 when response invalid', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);
		const response = await fastify.inject({method: 'GET', url: '/digest-auth/auth/user/pass', headers: {authorization: 'Digest username="user"'}});
		expect(response.statusCode).toBe(401);
	});

	it('401 when username mismatch', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);
		const response = await fastify.inject({method: 'GET', url: '/digest-auth/auth/user/pass', headers: {authorization: 'Digest username="someoneelse"'}});
		expect(response.statusCode).toBe(401);
	});

	it('401 challenge with algorithm variant', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);
		const response = await fastify.inject({method: 'GET', url: '/digest-auth/auth/user/pass/MD5'});
		expect(response.statusCode).toBe(401);
		expect(response.headers['www-authenticate']).toMatch(/algorithm=MD5/);
	});

	it('401 when no qop and mismatched response', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);

		const challenge = await fastify.inject({method: 'GET', url: '/digest-auth/auth/user/pass'});
		const hdr = challenge.headers['www-authenticate'] as string;
		const nonce = /nonce="([^"]+)"/.exec(hdr)?.[1] ?? '';
		const realm = /realm="([^"]+)"/.exec(hdr)?.[1] ?? '';
		const uri = '/digest-auth/auth/user/pass';
		const ha1 = crypto.createHash('md5').update(`user:${realm}:pass`).digest('hex');
		const ha2 = crypto.createHash('md5').update(`GET:${uri}`).digest('hex');
		// Wrong response intentionally
		const responseHash = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}WRONG`).digest('hex');
		const authHeader = `Digest username="user", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${responseHash}"`;
		const bad = await fastify.inject({method: 'GET', url: uri, headers: {authorization: authHeader}});
		expect(bad.statusCode).toBe(401);
	});
});
