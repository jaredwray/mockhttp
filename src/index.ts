// Import necessary modules
import Fastify from 'fastify';
import { fastifySwagger } from '@fastify/swagger';
import Redoc from 'redoc';

const fastify = Fastify({ logger: true });

// Set up Swagger for API documentation
fastify.register(fastifySwagger, {
  swagger: {
    info: {
      title: 'HTTPBin Replacement API',
      description: 'A replacement for httpbin built using Fastify, TypeScript, and Redoc',
      version: '1.0.0',
    },
    consumes: ['application/json'],
    produces: ['application/json'],
  },
});

// Define routes to mimic HTTPBin functionality
fastify.get('/get', async (request, reply) => {
  return {
    method: 'GET',
    headers: request.headers,
    queryParams: request.query,
  };
});

fastify.post('/post', async (request, reply) => {
  return {
    method: 'POST',
    headers: request.headers,
    body: request.body,
  };
});

fastify.put('/put', async (request, reply) => {
  return {
    method: 'PUT',
    headers: request.headers,
    body: request.body,
  };
});

fastify.delete('/delete', async (request, reply) => {
  return {
    method: 'DELETE',
    headers: request.headers,
    body: request.body,
  };
});

fastify.get('/status/:code', async (request, reply) => {
  const { code } = request.params;
  reply.code(Number(code));
  return {
    status: `Response with status code ${code}`,
  };
});

// Register Redoc for API documentation
fastify.get('/redoc', async (request, reply) => {
  const html = Redoc.generateHTML({
    title: 'HTTPBin Replacement API',
    specUrl: '/docs/json',
  });
  reply.type('text/html').send(html);
});

// Start the Fastify server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    fastify.log.info(`Server is running at http://localhost:3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
