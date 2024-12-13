import {
	describe, it, expect, beforeAll, afterAll,
} from 'vitest';
import Fastify from 'fastify';
import {cacheRoutes} from '../../../src/routes/response-inspection/index.js';

describe('Cache Routes', () => {
	// eslint-disable-next-line new-cap
	const fastify = Fastify();

	beforeAll(async () => {
		await fastify.register(cacheRoutes);
	});

	afterAll(async () => {
		await fastify.close();
	});

	it('should return a 304 if If-Modified-Since header is present', async () => {
		const response = await fastify.inject({
			method: 'GET',
			url: '/cache',
			headers: {
				'if-modified-since': new Date().toUTCString(),
			},
		});

		expect(response.statusCode).toBe(304);
		expect(response.body).toBe('');
	});

	it('should return a 304 if If-None-Match header is present', async () => {
		const response = await fastify.inject({
			method: 'GET',
			url: '/cache',
			headers: {
				'if-none-match': 'some-etag',
			},
		});

		expect(response.statusCode).toBe(304);
		expect(response.body).toBe('');
	});

	it('should return the cache content when no cache headers are present', async () => {
		const response = await fastify.inject({
			method: 'GET',
			url: '/cache',
		});

		expect(response.statusCode).toBe(200);
		expect(response.body).toBe('Cache content or resource response here.');
	});

	it('should set Cache-Control header for the given value in /cache/:value', async () => {
		const response = await fastify.inject({
			method: 'GET',
			url: '/cache/60',
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers['cache-control']).toBe('max-age=60');
		expect(response.body).toBe('Cache-Control set for 60 seconds.');
	});
});
