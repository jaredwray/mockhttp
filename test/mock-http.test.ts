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
});
