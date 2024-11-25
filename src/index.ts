import process from 'node:process';
import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import {fastifySwagger} from '@fastify/swagger';
import {indexRoute} from './routes/index-route.js';
import {fastifyConfig} from './fastify-config.js';
import {fastifySwaggerConfig, registerSwaggerUi} from './swagger.js';
import {ipRoute} from './routes/request-inspection/index.js';
import {
	getRoute, postRoute, deleteRoute, putRoute,
} from './routes/http-methods/index.js';
import {getStatusCodeRoute} from './routes/status-codes/index.js';

// eslint-disable-next-line new-cap
const fastify = Fastify(fastifyConfig);

await fastify.register(fastifyStatic, {
	root: path.resolve('./public'),
});

// Set up Swagger for API documentation
await fastify.register(fastifySwagger, fastifySwaggerConfig);

// Register Swagger UI
await registerSwaggerUi(fastify);

await fastify.register(getRoute);
await fastify.register(indexRoute);
await fastify.register(getStatusCodeRoute);
await fastify.register(postRoute);
await fastify.register(deleteRoute);
await fastify.register(putRoute);
await fastify.register(ipRoute);

// Start the Fastify server
const start = async () => {
	try {
		await fastify.listen({port: 3000, host: '127.0.0.1'});
		fastify.log.info('Server is running at http://localhost:3000');
	} catch (error) {
		fastify.log.error(error);
		// eslint-disable-next-line unicorn/no-process-exit
		process.exit(1);
	}
};

await start();
