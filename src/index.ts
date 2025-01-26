import process from 'node:process';
import {MockHttp} from './mock-http.js';

const mockHttp = new MockHttp();

// Start the Fastify server
export const start = async () => {
	if (process.env.PORT) {
		mockHttp.port = Number.parseInt(process.env.PORT, 10);
	}

	if (process.env.HOST) {
		mockHttp.host = process.env.HOST;
	}

	await mockHttp.start();
};

await start();

export {MockHttp as default, MockHttp as mockhttp} from './mock-http.js';
