import {describe, it, expect} from 'vitest';
import Fastify from 'fastify';
import {statusCodeRoute} from '../../../src/routes/status-codes/index.js';

describe('Status Codes Route', () => {
	// eslint-disable-next-line new-cap
	const fastify = Fastify();
	statusCodeRoute(fastify);

	it('should return a valid status code when provided', async () => {
		const response = await fastify.inject({
			method: 'GET',
			url: '/status/200',
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({status: 'Response with status code 200'});
	});

	it('should return a random status code when none is provided', async () => {
		const response = await fastify.inject({
			method: 'GET',
			url: '/status',
		});

		expect(response.statusCode).toBeGreaterThanOrEqual(100);
		expect(response.statusCode).toBeLessThanOrEqual(511);
	});

	it('should return a random status code when an invalid code is provided', async () => {
		const response = await fastify.inject({
			method: 'GET',
			url: '/status/999',
		});

		expect(response.statusCode).toBeGreaterThanOrEqual(100);
		expect(response.statusCode).toBeLessThanOrEqual(511);
	});
});
