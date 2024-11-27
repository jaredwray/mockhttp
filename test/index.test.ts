import process from 'node:process';
import {
	describe, it, expect, vi,
} from 'vitest';
import Fastify from 'fastify';
import {start} from '../src/index.js';

vi.mock('fastify', () => {
	const listen = vi.fn();
	const register = vi.fn();
	const log = {
		info: vi.fn(),
		error: vi.fn(),
	};
	return {
		default: () => ({
			listen,
			log,
			register,
		}),
	};
});

describe('start', () => {
	it('should start the server and log info', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		await start();
		expect(fastify.listen).toHaveBeenCalledWith({port: 3000, host: '0.0.0.0'});
	});

	it('should start the server and log info with different host and port', async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		process.env.PORT = '8080';
		process.env.HOST = 'localhost';
		await start();
		expect(fastify.listen).toHaveBeenCalledWith({port: 8080, host: 'localhost'});
	});
});
