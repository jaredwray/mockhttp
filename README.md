[![public/logo.svg](public/logo.svg)](https://mockhttp.org)

[![tests](https://github.com/jaredwray/mockhttp/actions/workflows/tests.yaml/badge.svg)](https://github.com/jaredwray/mockhttp/actions/workflows/tests.yaml)
[![GitHub license](https://img.shields.io/github/license/jaredwray/mockhttp)](https://github.com/jaredwray/mockhttp/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/mockhttp/graph/badge.svg?token=eqtqoA3olU)](https://codecov.io/gh/jaredwray/mockhttp)
[![npm](https://img.shields.io/npm/dm/@jaredwray/mockhttp)](https://npmjs.com/package/@jaredwray/mockhttp)
[![npm](https://img.shields.io/npm/v/@jaredwray/mockhttp)](https://npmjs.com/package/@jaredwray/mockhttp)
[![Docker Pulls](https://img.shields.io/docker/pulls/jaredwray/mockhttp)](https://hub.docker.com/r/jaredwray/mockhttp)
[![mockhttp.org](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fjaredwray.com%2Fapi%2Fmockhttp-traffic&query=%24.message&label=mockhttp.org)](https://mockhttp.org)

A simple HTTP server that can be used to mock HTTP responses for testing purposes. Inspired by [httpbin](https://httpbin.org/) and built using `nodejs` and `fastify` with the idea of running it via https://mockhttp.org, via docker `jaredwray/mockhttp`, or nodejs `npm install jaredwray/mockhttp`.

# Features
* All the features of [httpbin](https://httpbin.org/)
* Taps - Inject custom responses for testing and develepment
* `@fastify/helmet` built in by default
* Built with `nodejs`, `typescript`, and `fastify`
* Deploy via `docker` or `nodejs`
* Global deployment via [mockhttp.org](https://mockhttp.org) (free service)
* Better API documentation and examples
* Auto detect the port that is not in use
* Maintained and updated regularly!

# Deploy via Docker
```bash
docker run -d -p 3000:3000 jaredwray/mockhttp
```

# Deploy via Docker Compose
```yaml
services:
  mockhttp:
    image: jaredwray/mockhttp:latest
    ports:
      - "3000:3000"
```

If you want to run it on a different port, just change the `3000` to whatever port you want and add in the environment variable `PORT` to the environment.

```yaml
services:
  mockhttp:
    image: jaredwray/mockhttp:latest
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
```

You can see an example of this in the [docker-compose.yaml](docker-compose.yaml) file.

# Deploy via NodeJS
```bash
npm install @jaredwray/mockhttp --save
```

then run `mockhttp` in your code.

```javascript
import { mockhttp } from '@jaredwray/mockhttp';
await mockhttp.start(); // start the server
const response = await fetch('http://localhost:3000/get');
console.log(response);
await mockhttp.stop(); // stop the server
```

# Response Injection (Tap Feature)

The injection/tap feature allows you to "tap into" the request flow and inject custom responses for specific requests. This is particularly useful for:
- **Offline testing** - Mock external API responses without network access
- **Testing edge cases** - Simulate errors, timeouts, or specific response scenarios
- **Development** - Work on your application without depending on external services

## What is a "Tap"?

A "tap" is a reference to an injected response, similar to "wiretapping" - you're intercepting requests and returning predefined responses. Each tap can be removed when you're done with it, restoring normal server behavior.

## Basic Usage

```javascript
import { mockhttp } from '@jaredwray/mockhttp';

const mock = new mockhttp();
await mock.start();

// Inject a simple response
const tap = mock.taps.inject(
  {
    response: "Hello, World!",
    statusCode: 200,
    headers: { "Content-Type": "text/plain" }
  },
  {
    url: "/api/greeting",
    method: "GET"
  }
);

// Make requests - they will get the injected response
const response = await fetch('http://localhost:3000/api/greeting');
console.log(await response.text()); // "Hello, World!"

// Remove the injection when done
mock.taps.removeInjection(tap);

await mock.close();
```

## Advanced Examples

### Inject JSON Response

```javascript
const tap = mock.taps.inject(
  {
    response: { message: "Success", data: { id: 123 } },
    statusCode: 200
  },
  { url: "/api/users/123" }
);
```

### Wildcard URL Matching

```javascript
// Match all requests under /api/
const tap = mock.taps.inject(
  {
    response: "API is mocked",
    statusCode: 503
  },
  { url: "/api/*" }
);
```

### Multiple Injections

```javascript
const tap1 = mock.taps.inject(
  { response: "Users data" },
  { url: "/api/users" }
);

const tap2 = mock.taps.inject(
  { response: "Posts data" },
  { url: "/api/posts" }
);

// View all active injections
console.log(mock.taps.injections); // Map of all active taps

// Remove specific injections
mock.taps.removeInjection(tap1);
mock.taps.removeInjection(tap2);
```

### Match by HTTP Method

```javascript
// Only intercept POST requests
const tap = mock.taps.inject(
  { response: "Created", statusCode: 201 },
  { url: "/api/users", method: "POST" }
);
```

### Match by Headers

```javascript
const tap = mock.taps.inject(
  { response: "Authenticated response" },
  {
    url: "/api/secure",
    headers: {
      "authorization": "Bearer token123"
    }
  }
);
```

### Catch-All Injection

```javascript
// Match ALL requests (no matcher specified)
const tap = mock.taps.inject({
  response: "Server is in maintenance mode",
  statusCode: 503
});
```

### Dynamic Function Response

You can provide a function that dynamically generates the response based on the incoming request:

```javascript
// Function response with access to the request object
const tap = mock.taps.inject(
  (request) => {
    return {
      response: {
        message: `You requested ${request.url}`,
        method: request.method,
        timestamp: new Date().toISOString()
      },
      statusCode: 200,
      headers: {
        "X-Request-Path": request.url
      }
    };
  },
  { url: "/api/*" }
);
```

```javascript
// Conditional responses based on request
const tap = mock.taps.inject((request) => {
  // Return error for URLs containing 'error'
  if (request.url.includes('error')) {
    return {
      response: { error: "Something went wrong" },
      statusCode: 500
    };
  }

  // Return success for everything else
  return {
    response: { status: "success" },
    statusCode: 200
  };
});
```

```javascript
// Dynamic headers based on request
const tap = mock.taps.inject(
  (request) => ({
    response: "OK",
    statusCode: 200,
    headers: {
      "X-Original-Method": request.method,
      "X-Original-URL": request.url,
      "X-Original-Host": request.hostname
    }
  }),
  { url: "/api/mirror" }
);
```

# API Reference

## MockHttp Class

### Constructor

```javascript
new MockHttp(options?)
```

**Parameters:**
- `options?` (MockHttpOptions):
  - `port?`: number - The port to listen on (default: 3000)
  - `host?`: string - The host to listen on (default: '0.0.0.0')
  - `autoDetectPort?`: boolean - Auto-detect next available port if in use (default: true)
  - `helmet?`: boolean - Use Helmet for security headers (default: true)
  - `apiDocs?`: boolean - Enable Swagger API documentation (default: true)
  - `httpBin?`: HttpBinOptions - Configure which httpbin routes to enable
  - `hookOptions?`: HookifiedOptions - Hookified options

### Properties

- `port`: number - Get/set the server port
- `host`: string - Get/set the server host
- `autoDetectPort`: boolean - Get/set auto-detect port behavior
- `helmet`: boolean - Get/set Helmet security headers
- `apiDocs`: boolean - Get/set API documentation
- `httpBin`: HttpBinOptions - Get/set httpbin route options
- `server`: FastifyInstance - Get/set the Fastify server instance
- `taps`: TapManager - Get/set the TapManager instance

### Methods

#### `async start()`

Start the Fastify server. If already running, it will be closed and restarted.

#### `async close()`

Stop the Fastify server.

#### `async detectPort()`

Detect the next available port.

**Returns:** number - The available port

#### `async registerApiDocs(fastifyInstance?)`

Register Swagger API documentation routes.

#### `async registerHttpMethods(fastifyInstance?)`

Register HTTP method routes (GET, POST, PUT, PATCH, DELETE).

#### `async registerStatusCodeRoutes(fastifyInstance?)`

Register status code routes.

#### `async registerRequestInspectionRoutes(fastifyInstance?)`

Register request inspection routes (headers, ip, user-agent).

#### `async registerResponseInspectionRoutes(fastifyInstance?)`

Register response inspection routes (cache, etag, response-headers).

#### `async registerResponseFormatRoutes(fastifyInstance?)`

Register response format routes (json, xml, html, etc.).

#### `async registerRedirectRoutes(fastifyInstance?)`

Register redirect routes (absolute, relative, redirect-to).

#### `async registerCookieRoutes(fastifyInstance?)`

Register cookie routes (get, set, delete).

#### `async registerAnythingRoutes(fastifyInstance?)`

Register "anything" catch-all routes.

#### `async registerAuthRoutes(fastifyInstance?)`

Register authentication routes (basic, bearer, digest, hidden-basic).

## Taps (Response Injection)

Access the TapManager via `mockHttp.taps` to inject custom responses.

### `taps.inject(response, matcher?)`

Injects a custom response for requests matching the criteria.

**Parameters:**
- `response` (InjectionResponse | InjectionResponseFunction):
  - **Static Response** (InjectionResponse):
    - `response`: string | object | Buffer - The response body
    - `statusCode?`: number - HTTP status code (default: 200)
    - `headers?`: object - Response headers
  - **Function Response** (InjectionResponseFunction):
    - A function that receives the Fastify request object and returns an InjectionResponse
    - `(request: FastifyRequest) => InjectionResponse`
    - Allows dynamic response generation based on request properties (url, method, headers, etc.)

- `matcher?` (InjectionMatcher) - Optional matching criteria:
  - `url?`: string - URL path (supports wildcards with `*`)
  - `method?`: string - HTTP method (GET, POST, etc.)
  - `hostname?`: string - Hostname to match
  - `headers?`: object - Headers that must be present

**Returns:** `InjectionTap` - A tap object with a unique `id` that can be used to remove the injection

## `taps.removeInjection(tapOrId)`

Removes an injection.

**Parameters:**
- `tapOrId`: InjectionTap | string - The tap object or tap ID to remove

**Returns:** boolean - `true` if removed, `false` if not found

### `taps.injections`

A getter that returns a Map of all active injection taps.

**Returns:** `Map<string, InjectionTap>` - Map of all active injections with tap IDs as keys

## `taps.clear()`

Removes all injections.

## `taps.hasInjections`

A getter that returns whether there are any active injections.

**Returns:** boolean - `true` if there are active injections, `false` otherwise

# About mockhttp.org 

[mockhttp.org](https://mockhttp.org) is a free service that runs this codebase and allows you to use it for testing purposes. It is a simple way to mock HTTP responses for testing purposes. It is globally available has some limitations on it to prevent abuse such as requests per second. It is ran via [Cloudflare](https://cloudflare.com) and [Google Cloud Run](https://cloud.google.com/run/) across 7 regions globally and can do millions of requests per second.

# Contributing

Please read our [CODE OF CONDUCT](CODE_OF_CONDUCT.md) and [CONTRIBUTING](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

# License

[MIT License & © Jared Wray](LICENSE)
