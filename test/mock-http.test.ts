import {describe, test, expect} from 'vitest';
import {MockHttp, mockhttp} from '../src/mock-http.js';

describe('MockHttp', () => {
	test('should be a class', () => {
		expect(new MockHttp()).toBeInstanceOf(MockHttp);
	});

	test('mockhttp should be an instance of MockHttp', () => {
		// eslint-disable-next-line new-cap
		expect(new mockhttp()).toBeInstanceOf(MockHttp);
	});

	test('should be able to pass in options', () => {
		const options = {
			port: 8080,
			host: 'localhost',
			helmet: true,
			apiDocs: true,
			httpBin: true,
		};
		const mock = new MockHttp(options);

		expect(mock.host).toBe('localhost');
		expect(mock.helmet).toBe(true);
		expect(mock.apiDocs).toBe(true);
		expect(mock.httpBin).toBe(true);
	});

	test('should be able to set options', () => {
		const mock = new MockHttp();

		expect(mock.port).toBe(3000);
		expect(mock.host).toBe('0.0.0.0');
		expect(mock.helmet).toBe(true);
		expect(mock.apiDocs).toBe(true);
		expect(mock.httpBin).toBe(true);

		mock.port = 3001;
		mock.host = 'localhost';
		mock.helmet = false;
		mock.apiDocs = false;
		mock.httpBin = false;

		expect(mock.port).toBe(3001);
		expect(mock.host).toBe('localhost');
		expect(mock.helmet).toBe(false);
		expect(mock.apiDocs).toBe(false);
		expect(mock.httpBin).toBe(false);
	});

	test('should be able to get the Fastify server', () => {
		const mock = new MockHttp();

		expect(mock.server).toBeDefined();
	});
});
