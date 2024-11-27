import {describe, it, expect} from 'vitest';
import Fastify from 'fastify';
import {userAgentRoute} from '../../../src/routes/request-inspection/user-agent.js';

describe('GET /user-agent', () => {
	it('should return the User-Agent header', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		userAgentRoute(fastify);

		const response = await fastify.inject({
			method: 'GET',
			url: '/user-agent',
			headers: {
				'user-agent': 'Vitest',
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			userAgent: 'Vitest',
		});
	});

	it('should return empty string if User-Agent header is not present', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		userAgentRoute(fastify);

		const response = await fastify.inject({
			method: 'GET',
			url: '/user-agent',
			headers: {
				'user-agent': '',
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			userAgent: '',
		});
	});
});
