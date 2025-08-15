import {Buffer} from 'node:buffer';
import {
	describe, it, expect, vi,
} from 'vitest';
import Fastify from 'fastify';
import {basicAuthRoute} from '../../../src/routes/auth/basic.js';

const makeBasic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;

describe('GET /basic-auth/:user/:passwd', () => {
	it('401 without auth header', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		basicAuthRoute(fastify);
		const response = await fastify.inject({method: 'GET', url: '/basic-auth/user/pass'});
		expect(response.statusCode).toBe(401);
		expect(response.headers['www-authenticate']).toMatch(/Basic/);
	});

	it('401 with wrong creds', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		basicAuthRoute(fastify);
		const response = await fastify.inject({method: 'GET', url: '/basic-auth/user/pass', headers: {authorization: makeBasic('user', 'nope')}});
		expect(response.statusCode).toBe(401);
	});

	it('200 with correct creds', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		basicAuthRoute(fastify);
		const response = await fastify.inject({method: 'GET', url: '/basic-auth/user/pass', headers: {authorization: makeBasic('user', 'pass')}});
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({authenticated: true, user: 'user'});
	});

	it('401 with non-basic scheme', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		basicAuthRoute(fastify);
		const response = await fastify.inject({
			method: 'GET',
			url: '/basic-auth/user/pass',
			headers: {authorization: 'Bearer sometoken'},
		});
		expect(response.statusCode).toBe(401);
	});

	it('401 when decoded credentials have no colon', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		basicAuthRoute(fastify);
		// Base64 of 'nocolonhere'
		const bad = `Basic ${Buffer.from('nocolonhere').toString('base64')}`;
		const response = await fastify.inject({
			method: 'GET',
			url: '/basic-auth/user/pass',
			headers: {authorization: bad},
		});
		expect(response.statusCode).toBe(401);
	});
});
