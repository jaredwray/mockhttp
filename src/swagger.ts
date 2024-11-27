import {type FastifyInstance} from 'fastify';
import {fastifySwaggerUi} from '@fastify/swagger-ui';

export const fastifySwaggerConfig = {
	swagger: {
		info: {
			title: 'Mock HTTP API',
			description: 'A replacement for httpbin built using Fastify and Typescript',
			version: '1.0.0',
		},
		consumes: ['application/json'],
		produces: ['application/json'],
	},
};

export const registerSwaggerUi = async (fastify: FastifyInstance) => {
	await fastify.register(fastifySwaggerUi, {
		routePrefix: '/docs',
		uiConfig: {
			docExpansion: 'none',
			deepLinking: false,
		},
		uiHooks: {
			/* c8 ignore next 6 */
			onRequest(_request, _reply, next) {
				next();
			},
			preHandler(_request, _reply, next) {
				next();
			},
		},
		// eslint-disable-next-line @typescript-eslint/naming-convention
		staticCSP: true,
		transformSpecification: (swaggerObject, _request, _reply) => swaggerObject,
		transformSpecificationClone: true,
	});
};
