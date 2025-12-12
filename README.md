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

# Table of Contents
- [Deploy via Docker](#deploy-via-docker)
- [Deploy via Docker Compose](#deploy-via-docker-compose)
- [Deploy via NodeJS](#deploy-via-nodejs)
- [Response Injection (Tap Feature)](#response-injection-tap-feature)
- [Rate Limiting](#rate-limiting)
- [Logging](#logging)
- [API Reference](#api-reference)
- [About mockhttp.org](#about-mockhttporg)
- [Contributing](#contributing)
- [License](#license)

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

# Rate Limiting

MockHttp supports rate limiting using [@fastify/rate-limit](https://github.com/fastify/fastify-rate-limit). Rate limiting is **enabled by default** at **1000 requests per minute** with **localhost (127.0.0.1 and ::1) excluded** from rate limiting.

## Default Rate Limiting

By default, MockHttp applies the following rate limit:
- **1000 requests per minute** per IP address
- **Localhost is excluded** - requests from 127.0.0.1 and ::1 bypass rate limiting (ideal for local development and testing)

```javascript
import { MockHttp } from '@jaredwray/mockhttp';

const mock = new MockHttp();
await mock.start();
// Rate limiting is active (1000 req/min) except for localhost
```

## Customizing Rate Limiting

To customize rate limiting, pass a `rateLimit` configuration object when creating your MockHttp instance:

```javascript
import { MockHttp } from '@jaredwray/mockhttp';

const mock = new MockHttp({
  rateLimit: {
    max: 100,              // Maximum 100 requests
    timeWindow: '1 minute' // Per 1 minute window
  }
});

await mock.start();
```

## Common Configuration Options

The `rateLimit` option accepts all [@fastify/rate-limit options](https://github.com/fastify/fastify-rate-limit#options):

### Basic Rate Limiting

```javascript
// Limit to 50 requests per minute
const mock = new MockHttp({
  rateLimit: {
    max: 50,
    timeWindow: '1 minute'
  }
});
```

### Stricter Limits with Custom Error Response

```javascript
const mock = new MockHttp({
  rateLimit: {
    max: 30,
    timeWindow: 60000, // 1 minute in milliseconds
    errorResponseBuilder: (req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${context.after}`
    })
  }
});
```

### Allow List (Exclude Specific IPs)

```javascript
const mock = new MockHttp({
  rateLimit: {
    max: 100,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', '192.168.1.100'] // These IPs bypass rate limiting
  }
});
```

### Custom Key Generator (Rate Limit by Header)

```javascript
const mock = new MockHttp({
  rateLimit: {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Rate limit by API key instead of IP
      return request.headers['x-api-key'] || request.ip;
    }
  }
});
```

### Advanced Configuration

```javascript
const mock = new MockHttp({
  rateLimit: {
    global: true,                    // Apply to all routes
    max: 100,                        // Max requests
    timeWindow: '1 minute',          // Time window
    cache: 10000,                    // Cache size for tracking clients
    skipOnError: false,              // Don't skip on storage errors
    ban: 10,                         // Ban after 10 rate limit violations
    continueExceeding: false,        // Don't reset window on each request
    enableDraftSpec: true,           // Use IETF draft spec headers
    addHeaders: {                    // Customize rate limit headers
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true
    }
  }
});
```

## Disabling Rate Limiting

To disable rate limiting completely, set the `rateLimit` option to `false`:

```javascript
const mock = new MockHttp({
  rateLimit: false // Completely disable rate limiting
});

await mock.start();
// No rate limiting is applied to any requests
```

**Note:** To change rate limiting settings after the server has started, you must restart the server:

```javascript
const mock = new MockHttp();
await mock.start(); // Starts with default rate limiting

// To change or disable rate limiting:
await mock.close();
mock.rateLimit = undefined; // or set new options
await mock.start(); // Restarts with new settings
```

## Available Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `max` | number \| function | `1000` | Maximum requests per time window |
| `timeWindow` | number \| string | `60000` | Duration of rate limit window (milliseconds or string like '1 minute') |
| `cache` | number | `5000` | LRU cache size for tracking clients |
| `allowList` | array \| function | `[]` | IPs or function to exclude from rate limiting |
| `keyGenerator` | function | IP-based | Function to generate unique client identifier |
| `errorResponseBuilder` | function | Default 429 | Custom error response function |
| `skipOnError` | boolean | `false` | Skip rate limiting if storage errors occur |
| `ban` | number | `-1` | Ban client after N violations (disabled by default) |
| `continueExceeding` | boolean | `false` | Renew time window on each request while limited |
| `enableDraftSpec` | boolean | `false` | Use IETF draft specification headers |

For the complete list of options, see the [@fastify/rate-limit documentation](https://github.com/fastify/fastify-rate-limit#options).

# Logging

MockHttp uses [Pino](https://github.com/pinojs/pino) for logging via Fastify's built-in logger. Logging is **enabled by default** but can be disabled when needed.

## Disabling Logging

```javascript
import { MockHttp } from '@jaredwray/mockhttp';

const mock = new MockHttp({ logging: false });
await mock.start();
// Server runs silently without any log output
```

You can also disable logging via the `LOGGING` environment variable:

```bash
LOGGING=false node your-app.js
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
  - `rateLimit?`: RateLimitPluginOptions - Configure rate limiting (default: 1000 req/min, localhost excluded)
  - `logging?`: boolean - Enable logging (default: true)
  - `httpBin?`: HttpBinOptions - Configure which httpbin routes to enable
    - `httpMethods?`: boolean - Enable HTTP method routes (default: true)
    - `redirects?`: boolean - Enable redirect routes (default: true)
    - `requestInspection?`: boolean - Enable request inspection routes (default: true)
    - `responseInspection?`: boolean - Enable response inspection routes (default: true)
    - `statusCodes?`: boolean - Enable status code routes (default: true)
    - `responseFormats?`: boolean - Enable response format routes (default: true)
    - `cookies?`: boolean - Enable cookie routes (default: true)
    - `anything?`: boolean - Enable anything routes (default: true)
    - `auth?`: boolean - Enable authentication routes (default: true)
    - `images?`: boolean - Enable image routes (default: true)
  - `hookOptions?`: HookifiedOptions - Hookified options

### Properties

- `port`: number - Get/set the server port
- `host`: string - Get/set the server host
- `autoDetectPort`: boolean - Get/set auto-detect port behavior
- `helmet`: boolean - Get/set Helmet security headers
- `apiDocs`: boolean - Get/set API documentation
- `logging`: boolean - Get/set logging enabled state
- `rateLimit`: RateLimitPluginOptions | undefined - Get/set rate limiting options
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

#### `async registerImageRoutes(fastifyInstance?)`

Register image routes (jpeg, png, svg, webp) with content negotiation support.

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
