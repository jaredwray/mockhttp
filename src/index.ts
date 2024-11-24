// Import necessary modules
import Fastify from 'fastify';
import { fastifySwagger } from '@fastify/swagger';
import { fastifySwaggerUi } from '@fastify/swagger-ui';
import { FastifyRequest } from 'fastify';

type StatusRequest = FastifyRequest<{ Params: { code: string } }>;

const fastify = Fastify({ logger: true });

// Set up Swagger for API documentation
fastify.register(fastifySwagger, {
    swagger: {
      info: {
        title: 'HTTPBin Replacement API',
        description: 'A replacement for httpbin built using Fastify, TypeScript, and ReDoc',
        version: '1.0.0',
      },
      consumes: ['application/json'],
      produces: ['application/json'],
    },
  });

  fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'none',
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (_request, _reply, next) {
        next();
      },
      preHandler: function (_request, _reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformSpecification: (swaggerObject, _request, _reply) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });

// Define routes to mimic HTTPBin functionality
fastify.get('/get', async (request) => {
  return {
    method: 'GET',
    headers: request.headers,
    queryParams: request.query,
  };
});

fastify.post('/post', async (request) => {
  return {
    method: 'POST',
    headers: request.headers,
    body: request.body,
  };
});

fastify.put('/put', async (request) => {
  return {
    method: 'PUT',
    headers: request.headers,
    body: request.body,
  };
});

fastify.delete('/delete', async (request) => {
  return {
    method: 'DELETE',
    headers: request.headers,
    body: request.body,
  };
});

fastify.get('/status/:code', async (request: StatusRequest, reply) => {
  const { code } = request.params;
  reply.code(Number(code));
  return {
    status: `Response with status code ${code}`,
  };
});

// Register Redoc for API documentation
fastify.get('/', async (_request, reply) => {
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
</html>`
  reply.type('text/html').send(redocHtml);
});

// Start the Fastify server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '127.0.0.1' });
    fastify.log.info(`Server is running at http://localhost:3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
