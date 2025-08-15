import process from 'node:process';
import {MockHttp} from './mock-http.js';

// Start the Fastify server
export const start = async () => {
	const mockHttp = new MockHttp();

	if (process.env.PORT) {
		mockHttp.port = Number.parseInt(process.env.PORT, 10);
	}

	if (process.env.HOST) {
		mockHttp.host = process.env.HOST;
	}

	await mockHttp.start();

	return mockHttp;
};

// Only start the server if this is the main module (not imported)
/* c8 ignore start */
if (import.meta.url === `file://${process.argv[1]}`) {
	await start();
}
/* c8 ignore end */

export {MockHttp as default, MockHttp as mockhttp} from './mock-http.js';
