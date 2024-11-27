import process from 'node:process';
import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import {fastifySwagger} from '@fastify/swagger';
import {indexRoute} from './routes/index-route.js';
import {fastifyConfig} from './fastify-config.js';
import {fastifySwaggerConfig, registerSwaggerUi} from './swagger.js';
import {ipRoute, headersRoute, userAgentRoute} from './routes/request-inspection/index.js';
import {
	getRoute, postRoute, deleteRoute, putRoute, patchRoute,
} from './routes/http-methods/index.js';
import {statusCodeRoute} from './routes/status-codes/index.js';

// eslint-disable-next-line new-cap
const fastify = Fastify(fastifyConfig);

await fastify.register(fastifyStatic, {
	root: path.resolve('./public'),
});

// Set up Swagger for API documentation
await fastify.register(fastifySwagger, fastifySwaggerConfig);

// Register Swagger UI
await registerSwaggerUi(fastify);

// Register the index / home page route
await fastify.register(indexRoute);
// Register the HTTP method routes
await fastify.register(getRoute);
await fastify.register(postRoute);
await fastify.register(deleteRoute);
await fastify.register(putRoute);
await fastify.register(patchRoute);
// Register the request inspection routes
await fastify.register(ipRoute);
await fastify.register(headersRoute);
await fastify.register(userAgentRoute);
// Register the status code routes
await fastify.register(statusCodeRoute);

// Start the Fastify server
export const start = async () => {
	try {
		let port = 3000;
		if (process.env.PORT) {
			port = Number.parseInt(process.env.PORT, 10);
		}

		let host = '0.0.0.0';
		if (process.env.HOST) {
			host = process.env.HOST;
		}

		await fastify.listen({port, host});
	} catch (error) {
		/* c8 ignore next 4 */
		fastify.log.error(error);
		// eslint-disable-next-line unicorn/no-process-exit
		process.exit(1);
	}
};

await start();
