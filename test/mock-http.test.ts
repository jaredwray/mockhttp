import {
	describe, test, expect,
} from 'vitest';
import Fastify from 'fastify';
import {MockHttp, mockhttp, type MockHttpOptions} from '../src/mock-http.js';

describe('MockHttp', () => {
	test('should be a class', () => {
		expect(new MockHttp()).toBeInstanceOf(MockHttp);
	});

	test('mockhttp should be an instance of MockHttp', () => {
		// eslint-disable-next-line new-cap
		expect(new mockhttp()).toBeInstanceOf(MockHttp);
	});

	test('should be able to set the server', () => {
		const mock = new MockHttp();
		// eslint-disable-next-line new-cap
		const app = Fastify();
		mock.server = app;

		expect(mock.server).toBe(app);
	});

	test('should be able to pass in options', () => {
		const options: MockHttpOptions = {
			port: 8080,
			host: 'localhost',
			helmet: true,
			apiDocs: true,
			httpBin: {httpMethods: false},
		};
		const mock = new MockHttp(options);

		expect(mock.host).toBe('localhost');
		expect(mock.helmet).toBe(true);
		expect(mock.apiDocs).toBe(true);
		expect(mock.httpBin).toBe(options.httpBin);
	});

	test('should be able to set options', () => {
		const mock = new MockHttp();

		expect(mock.port).toBe(3000);
		expect(mock.host).toBe('0.0.0.0');
		expect(mock.autoDetectPort).toBe(true);
		expect(mock.helmet).toBe(true);
		expect(mock.apiDocs).toBe(true);
		expect(mock.httpBin.httpMethods).toBe(true);

		mock.port = 3001;
		mock.host = 'localhost';
		mock.autoDetectPort = false;
		mock.helmet = false;
		mock.apiDocs = false;
		mock.httpBin = {
			httpMethods: false,
			redirects: false,
			requestInspection: false,
			responseInspection: false,
			statusCodes: false,
		};

		expect(mock.port).toBe(3001);
		expect(mock.host).toBe('localhost');
		expect(mock.autoDetectPort).toBe(false);
		expect(mock.helmet).toBe(false);
		expect(mock.apiDocs).toBe(false);
		expect(mock.httpBin.httpMethods).toBe(false);
	});

	test('should be able to get the Fastify server', () => {
		const mock = new MockHttp();

		expect(mock.server).toBeDefined();
	});
});
