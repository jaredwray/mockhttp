import {type FastifyInstance, type FastifyRequest, type FastifyReply} from 'fastify';

export const indexRoute = (fastify: FastifyInstance) => {
	fastify.get('/', {schema: {hide: true}}, async (_request: FastifyRequest, reply: FastifyReply) => {
		const redocHtml = `
	<!DOCTYPE html>
	<html>
	<head>
	<meta charset="UTF-8">
	<title>{ mockhttp }</title>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700">
	<style>
		body {
		margin: 0;
		padding: 0;
		}
	</style>
	</head>
	<body>
	<redoc spec-url='/docs/json'></redoc>
	<script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
	</body>
	</html>`;
		await reply.type('text/html').send(redocHtml);
	});
};
