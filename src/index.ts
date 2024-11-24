import process from 'node:process';
import Fastify from 'fastify';
import {fastifySwagger} from '@fastify/swagger';
import {getRoute} from './routes/get-route.js';
import {indexRoute} from './routes/index-route.js';
import {statusRoute} from './routes/status-route.js';
import {postRoute} from './routes/post-route.js';
import {fastifyConfig} from './fastify-config.js';
import {fastifySwaggerConfig, registerSwaggerUi} from './swagger.js';
import {deleteRoute} from './routes/delete-route.js';
import {putRoute} from './routes/put-route.js';
import {ipRoute} from './routes/ip-route.js';

// eslint-disable-next-line new-cap
const fastify = Fastify(fastifyConfig);

// Set up Swagger for API documentation
await fastify.register(fastifySwagger, fastifySwaggerConfig);

// Register Swagger UI
await registerSwaggerUi(fastify);

await fastify.register(getRoute);
await fastify.register(indexRoute);
await fastify.register(statusRoute);
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
