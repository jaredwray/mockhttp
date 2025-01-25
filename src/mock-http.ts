import {Hookified, type HookifiedOptions} from 'hookified';

export type MockHttpOptions = {
	/**
	 * The port to listen on. If not provided, defaults to 3000 and falls back to 3001 if the PORT is in use.
	 */
	port?: number;
	/**
	 * The host to listen on. If not provided, defaults to '0.0.0.0'.
	 */
	host?: string;
	/**
	 * Whether to use Helmet for security headers. Defaults to true.
	 */
	helmet?: boolean;
	/**
	 * Whether to use Swagger for API documentation. Defaults to true.
	 */
	apiDocs?: boolean;
	/**
	 * Whether to use Swagger UI. Defaults to true.
	 */
	httpBin?: boolean;
	/**
	 * Hookified options.
	 */
	hookOptions?: HookifiedOptions;
};

export class MockHttp extends Hookified {
	constructor(options?: MockHttpOptions) {
		super(options?.hookOptions);
	}
}

export const mockhttp = MockHttp;
