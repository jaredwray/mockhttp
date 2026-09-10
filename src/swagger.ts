import type { FastifyInstance } from "fastify";
import pkg from "../package.json" with { type: "json" };

const description = `
A simple HTTP server that can be used to mock HTTP responses for testing purposes. Inspired by [httpbin](https://httpbin.org/) and built using \`nodejs\` and \`fastify\` with the idea of running it via https://mockhttp.org, via docker \`jaredwray/mockhttp\`, or nodejs \`npm install @jaredwray/mockhttp\`.

* [GitHub Repository](https://github.com/jaredwray/mockhttp)
* [Docker Image](https://hub.docker.com/r/jaredwray/mockhttp)
* [NPM Package](https://www.npmjs.com/package/@jaredwray/mockhttp)

# About mockhttp.org

[mockhttp.org](https://mockhttp.org) is a free hosted instance of this codebase for testing. It runs entirely on [Cloudflare](https://www.cloudflare.com/) using Workers and [Containers](https://developers.cloudflare.com/containers/). The service is globally available and rate-limited (1000 requests per minute per IP) to prevent abuse.
`;

export const fastifySwaggerConfig = {
	openapi: {
		info: {
			title: "Mock HTTP API",
			description,
			version: pkg.version,
		},
		servers: [
			{ url: "/", description: "This instance" },
			{ url: "https://mockhttp.org", description: "Hosted service" },
		],
	},
};

export const registerOpenApiJson = async (fastify: FastifyInstance) => {
	fastify.get("/openapi.json", { schema: { hide: true } }, async () =>
		fastify.swagger(),
	);
};
