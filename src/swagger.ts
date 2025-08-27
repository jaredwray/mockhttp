import { fastifySwaggerUi } from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import pkg from "../package.json" with { type: "json" };

const description = `
A simple HTTP server that can be used to mock HTTP responses for testing purposes. Inspired by [httpbin](https://httpbin.org/) and built using \`nodejs\` and \`fastify\` with the idea of running it via https://mockhttp.org, via docker \`jaredwray/mockhttp\`, or nodejs \`npm install jaredwray/mockhttp\`.

* [GitHub Repository](https://github.com/jaredwray/mockhttp)
* [Docker Image](https://hub.docker.com/r/jaredwray/mockhttp)
* [NPM Package](https://www.npmjs.com/package/jaredwray/mockhttp)

# About mockhttp.org 

[mockhttp.org](https://mockhttp.org) is a free service that runs this codebase and allows you to use it for testing purposes. It is a simple way to mock HTTP responses for testing purposes. Ran via [Cloudflare](https://cloudflare.com) and [Google Cloud Run](https://cloud.google.com/run/) across 7 regions globally and can do millions of requests per second.
`;

export const fastifySwaggerConfig = {
	openapi: {
		info: {
			title: "Mock HTTP API",
			description,
			version: pkg.version,
		},
		consumes: ["application/json"],
		produces: ["application/json"],
	},
};

export const registerSwaggerUi = async (fastify: FastifyInstance) => {
	await fastify.register(fastifySwaggerUi, {
		routePrefix: "/docs",
		uiConfig: {
			docExpansion: "none",
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

		staticCSP: true,
		transformSpecification: (swaggerObject, _request, _reply) => swaggerObject,
		transformSpecificationClone: true,
	});
};
