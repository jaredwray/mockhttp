import {describe, it, expect} from 'vitest';
import {hashAlg} from '../../src/routes/auth/digest.js';

describe('hashAlg', () => {
	it('returns md5 when undefined', () => {
		expect(hashAlg(undefined)).toBe('md5');
	});

	it('returns md5 for md5 (lower/upper case variants)', () => {
		expect(hashAlg('md5')).toBe('md5');
		expect(hashAlg('MD5')).toBe('md5');
	});

	it('returns sha256 for sha-256', () => {
		expect(hashAlg('sha-256')).toBe('sha256');
		expect(hashAlg('SHA-256')).toBe('sha256');
	});

	it('returns sha512 for sha-512', () => {
		expect(hashAlg('sha-512')).toBe('sha512');
		expect(hashAlg('SHA-512')).toBe('sha512');
	});

	it('defaults to md5 for unknown strings', () => {
		expect(hashAlg('unknown')).toBe('md5');
		expect(hashAlg('')).toBe('md5');
	});
});
