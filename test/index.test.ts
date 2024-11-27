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
		expect(fastify.listen).toHaveBeenCalledWith({port: 3000, host: '127.0.0.1'});
		expect(fastify.log.info).toHaveBeenCalledWith('Server is running at http://localhost:3000');
	});
});
