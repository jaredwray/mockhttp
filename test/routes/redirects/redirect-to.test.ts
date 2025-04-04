import {describe, test, expect} from 'vitest';
import Fastify from 'fastify';
import {redirectToRoute} from '../../../src/routes/redirects/redirect-to.js';

describe('Redirect To Route', async () => {
	// eslint-disable-next-line new-cap
	const fastify = Fastify();
	await fastify.register(redirectToRoute);

	test('should redirect to the target URL using an absolute URL', async () => {
		const response = await fastify.inject({
			method: 'GET',
			url: '/redirect-to',
			query: {
				url: 'https://mockhttp.org',
				// eslint-disable-next-line  @typescript-eslint/naming-convention
				status_code: '301',
			},
		});
		expect(response.statusCode).toBe(301);
		expect(response.headers.location).toBe('https://mockhttp.org');
	});

	test('should redirect to the target URL without status code', async () => {
		const response = await fastify.inject({
			method: 'GET',
			url: '/redirect-to',
			query: {
				url: 'https://mockhttp.org',
			},
		});
		expect(response.statusCode).toBe(302);
		expect(response.headers.location).toBe('https://mockhttp.org');
	});
});
