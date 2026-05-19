[![public/logo.svg](public/logo.svg)](https://mockhttp.org)

[![tests](https://github.com/jaredwray/mockhttp/actions/workflows/tests.yaml/badge.svg)](https://github.com/jaredwray/mockhttp/actions/workflows/tests.yaml)
[![GitHub license](https://img.shields.io/github/license/jaredwray/mockhttp)](https://github.com/jaredwray/mockhttp/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/mockhttp/graph/badge.svg?token=eqtqoA3olU)](https://codecov.io/gh/jaredwray/mockhttp)
[![npm](https://img.shields.io/npm/dm/@jaredwray/mockhttp)](https://npmjs.com/package/@jaredwray/mockhttp)
[![npm](https://img.shields.io/npm/v/@jaredwray/mockhttp)](https://npmjs.com/package/@jaredwray/mockhttp)
[![Docker Pulls](https://img.shields.io/docker/pulls/jaredwray/mockhttp)](https://hub.docker.com/r/jaredwray/mockhttp)
[![mockhttp.org](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fjaredwray.com%2Fapi%2Fmockhttp-traffic&query=%24.message&label=mockhttp.org)](https://mockhttp.org)

A simple HTTP server that can be used to mock HTTP responses for testing purposes. Inspired by [httpbin](https://httpbin.org/) and built using `nodejs` and `fastify` with the idea of running it via https://mockhttp.org, via docker `jaredwray/mockhttp`, or nodejs `npm install @jaredwray/mockhttp`.

# Features
* All the features of [httpbin](https://httpbin.org/)
* Taps - Inject custom responses for testing and development
* Bins - Capture and inspect incoming HTTP requests (great for webhook debugging)
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
- [HTTPS Support](#https-support)
- [HTTP/2 Support](#http2-support)
- [Response Injection (Tap Feature)](#response-injection-tap-feature)
- [Request Bins](#request-bins)
- [Rate Limiting](#rate-limiting)
- [Logging](#logging)
- [Flexible URL Matching](#flexible-url-matching)
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
import { MockHttp } from '@jaredwray/mockhttp';
const mock = new MockHttp();
await mock.start(); // start the server
const response = await fetch('http://localhost:3000/get');
console.log(response);
await mock.close(); // stop the server
```

# HTTPS Support

MockHttp supports HTTPS with auto-generated self-signed certificates or your own custom certificates. No external dependencies are required — certificate generation uses only Node.js built-in `crypto`.

## Auto-Generated Certificate

The simplest way to enable HTTPS is to pass `https: true`. A self-signed certificate for `localhost` is generated automatically:

```javascript
import { MockHttp } from '@jaredwray/mockhttp';

const mock = new MockHttp({ https: true });
await mock.start();

console.log(mock.isHttps); // true

// Use Fastify's built-in inject() for testing (no TLS setup needed)
const response = await mock.server.inject({ method: 'GET', url: '/get' });
console.log(response.statusCode); // 200

await mock.close();
```

> **Note:** Self-signed certificates are not trusted by default. When making real HTTPS requests (e.g. with `fetch`), set `NODE_TLS_REJECT_UNAUTHORIZED=0` in your test environment or use a custom HTTPS agent.

## Custom Certificate Options

You can customize the auto-generated certificate by passing `certificateOptions`:

```javascript
const mock = new MockHttp({
  https: {
    certificateOptions: {
      commonName: 'my-test-server',
      validityDays: 30,
      keySize: 4096,
      altNames: [
        { type: 'dns', value: 'example.local' },
        { type: 'dns', value: '*.example.local' },
        { type: 'ip', value: '192.168.1.100' },
      ],
    },
  },
});

await mock.start();
// Make requests...
await mock.close();
```

## Provide Your Own Certificate

You can supply your own PEM-encoded certificate and key, either as strings or file paths:

```javascript
// Using PEM strings
const mock = new MockHttp({
  https: {
    cert: '-----BEGIN CERTIFICATE-----\n...',
    key: '-----BEGIN PRIVATE KEY-----\n...',
  },
});
await mock.start();
// Make requests...
await mock.close();
```

```javascript
// Using file paths
const mock = new MockHttp({
  https: {
    cert: '/path/to/cert.pem',
    key: '/path/to/key.pem',
  },
});
await mock.start();
// Make requests...
await mock.close();
```

## Standalone Certificate Generation

You can also generate certificates independently using the exported utility functions:

```javascript
import { generateCertificate, generateCertificateFiles } from '@jaredwray/mockhttp';

// Generate in-memory PEM strings
const { cert, key } = generateCertificate({
  commonName: 'my-app',
  validityDays: 90,
});

// Generate and write to disk
const result = await generateCertificateFiles({
  certPath: './certs/cert.pem',
  keyPath: './certs/key.pem',
  commonName: 'my-app',
});
```

## HTTPS Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cert` | string | — | PEM-encoded certificate string or file path |
| `key` | string | — | PEM-encoded private key string or file path |
| `autoGenerate` | boolean | `true` | Auto-generate a self-signed certificate when cert/key are not provided |
| `certificateOptions` | CertificateOptions | — | Options for the auto-generated certificate |

### Certificate Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `commonName` | string | `'localhost'` | Certificate subject Common Name (CN) |
| `altNames` | Array\<{ type, value }\> | `[dns:localhost, ip:127.0.0.1, ip:::1]` | Subject Alternative Names with type `'dns'` or `'ip'` |
| `validityDays` | number | `365` | Certificate validity period in days |
| `keySize` | number | `2048` | RSA key size in bits |

# HTTP/2 Support

MockHttp supports HTTP/2 in two modes:
- **h2** — HTTP/2 over TLS (used by browsers), enabled with both `http2: true` and `https: true`
- **h2c** — HTTP/2 cleartext (no TLS), enabled with just `http2: true`, useful for service-to-service testing

## HTTP/2 over TLS (h2)

```javascript
import { MockHttp } from '@jaredwray/mockhttp';

const mock = new MockHttp({ http2: true, https: true });
await mock.start();

console.log(mock.http2); // true
console.log(mock.isHttps); // true

const response = await mock.server.inject({ method: 'GET', url: '/get' });
console.log(response.statusCode); // 200

await mock.close();
```

By default, HTTP/1.1 clients can still connect via ALPN negotiation (`http1` defaults to `true`). To disable HTTP/1.1 fallback:

```javascript
const mock = new MockHttp({ http2: true, https: true, http1: false });
await mock.start();
```

## HTTP/2 Cleartext (h2c)

```javascript
const mock = new MockHttp({ http2: true });
await mock.start();

console.log(mock.http2); // true

await mock.close();
```

> **Note:** Browsers do not support h2c. This mode is useful for testing gRPC or service-to-service communication.

## HTTP/2 via Environment Variable

```bash
HTTP2=true node your-app.js
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

# Request Bins

Bins are ephemeral URL endpoints that **capture incoming HTTP requests** so you
can inspect them later. They're the inverse of Taps: instead of injecting a
response, they record everything they receive. Useful for:

- **Debugging webhooks** — point Stripe / GitHub / Slack at a bin URL and see
  exactly what they send
- **Exercising client SDKs** — verify your SDK sends the request shape you expect
- **Recording fixtures** — capture real traffic to replay in tests later

There are two URL prefixes:

- **`/bins`** — JSON management API: create, list, inspect, delete bins
- **`/b/:id`** — the capture URL. Any HTTP method, any sub-path, any body sent
  here is stored against bin `:id`

## Quick Start

```bash
# 1. create a bin
curl -s -X POST http://localhost:3000/bins
# → { "id": "abc123def456", "url": "http://localhost:3000/b/abc123def456",
#     "createdAt": "2026-05-18T12:00:00.000Z",
#     "expiresAt": "2026-05-19T12:00:00.000Z",
#     "requestCount": 0 }

# 2. send anything to the capture URL
curl -X POST "http://localhost:3000/b/abc123def456/webhook?source=stripe" \
  -H 'content-type: application/json' \
  -d '{"event":"payment.succeeded"}'
# → { "ok": true, "binId": "abc123def456", "requestId": "f9c2e1a40b3d" }

# 3. list captured requests (newest first)
curl http://localhost:3000/bins/abc123def456/requests
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/bins` | Create a new bin |
| GET | `/bins` | List all active bins |
| GET | `/bins/:id` | Get bin metadata |
| GET | `/bins/:id/requests` | List captured requests (newest first) |
| GET | `/bins/:id/requests/:reqId` | Get a single captured request |
| DELETE | `/bins/:id/requests` | Clear all captured requests in a bin |
| DELETE | `/bins/:id` | Delete a bin |
| ANY | `/b/:id` and `/b/:id/*` | Capture requests sent to a bin |

## End-to-End Webhook Debugging Example

A complete walkthrough using curl:

```bash
BASE=http://localhost:3000

# Create the bin and grab its id
ID=$(curl -s -X POST $BASE/bins | jq -r .id)
echo "Bin URL: $BASE/b/$ID"

# Simulate a Stripe webhook
curl -s -X POST "$BASE/b/$ID/stripe/events?secret=whsec_test" \
  -H 'content-type: application/json' \
  -H 'stripe-signature: t=1700000000,v1=abc123' \
  -d '{"id":"evt_1","type":"payment_intent.succeeded","data":{"object":{"amount":2000}}}'

# Simulate a GitHub webhook
curl -s -X POST "$BASE/b/$ID/github" \
  -H 'content-type: application/json' \
  -H 'x-github-event: pull_request' \
  -d '{"action":"opened","number":42}'

# Inspect everything that arrived
curl -s "$BASE/bins/$ID/requests" | jq

# Drill into the most recent one
RID=$(curl -s "$BASE/bins/$ID/requests" | jq -r '.requests[0].id')
curl -s "$BASE/bins/$ID/requests/$RID" | jq
#   {
#     "id": "f9c2e1a40b3d",
#     "binId": "abc123def456",
#     "method": "POST",
#     "url": "/github",
#     "path": "/github",
#     "query": {},
#     "headers": {
#       "host": "localhost:3000",
#       "content-type": "application/json",
#       "x-github-event": "pull_request"
#     },
#     "remoteAddress": "127.0.0.1",
#     "contentType": "application/json",
#     "bodySize": 32,
#     "body": "{\"action\":\"opened\",\"number\":42}",
#     "bodyEncoding": "utf8",
#     "truncated": false,
#     "capturedAt": "2026-05-18T12:00:01.234Z"
#   }

# Clean up
curl -s -X DELETE "$BASE/bins/$ID/requests"  # clear captures, keep the bin
curl -s -X DELETE "$BASE/bins/$ID"           # delete the bin entirely
```

## Captured Request Shape

```json
{
  "id": "f9c2e1a40b3d",
  "binId": "abc123def456",
  "method": "POST",
  "url": "/webhook?source=stripe",
  "path": "/webhook",
  "query": { "source": "stripe" },
  "headers": { "content-type": "application/json", "...": "..." },
  "remoteAddress": "127.0.0.1",
  "contentType": "application/json",
  "bodySize": 32,
  "body": "{\"event\":\"payment.succeeded\"}",
  "bodyEncoding": "utf8",
  "truncated": false,
  "capturedAt": "2026-05-18T12:00:00.000Z"
}
```

- **`url`** is the request URL relative to the bin (everything after `/b/:id`).
- **`path`** is the sub-path only, without the query string.
- **`bodyEncoding`** is `"utf8"` for text content types (text/*, application/json,
  application/xml, application/x-www-form-urlencoded, application/javascript),
  `"base64"` for everything else (binary payloads), or `"none"` when no body
  was sent.
- **`truncated`** is `true` when the body exceeded `maxBodySize` and was cut
  off. `bodySize` reflects the original length.

## Body Encoding Examples

### Text Content (UTF-8)

JSON, XML, form-encoded, plain text, and JavaScript are stored as UTF-8 strings
so you can read them directly:

```bash
curl -X POST "http://localhost:3000/b/$ID" \
  -H 'content-type: application/json' \
  -d '{"hello":"world"}'

curl -s "http://localhost:3000/bins/$ID/requests" | jq '.requests[0] | {bodyEncoding, body}'
# {
#   "bodyEncoding": "utf8",
#   "body": "{\"hello\":\"world\"}"
# }
```

### Binary Content (Base64)

Any non-text content type is base64-encoded, preserving the bytes exactly:

```bash
# Upload a PNG to the bin
curl -X POST "http://localhost:3000/b/$ID/upload" \
  -H 'content-type: image/png' \
  --data-binary @logo.png

curl -s "http://localhost:3000/bins/$ID/requests" | jq '.requests[0] | {bodyEncoding, bodySize}'
# {
#   "bodyEncoding": "base64",
#   "bodySize": 14823
# }

# Decode the body back to bytes
curl -s "http://localhost:3000/bins/$ID/requests" \
  | jq -r '.requests[0].body' | base64 -d > recovered.png
```

### Truncation

Bodies larger than `maxBodySize` (1 MiB by default) are cut off and flagged:

```javascript
// In test setup
import { MockHttp, BinManager } from '@jaredwray/mockhttp';
const mock = new MockHttp();
mock.bins = new BinManager({ maxBodySize: 1024 }); // 1 KiB cap
await mock.start();
```

```bash
# Send 5000 bytes to a bin with a 1 KiB cap
head -c 5000 /dev/urandom | curl -X POST "http://localhost:3000/b/$ID" \
  -H 'content-type: application/octet-stream' \
  --data-binary @-

curl -s "http://localhost:3000/bins/$ID/requests" | jq '.requests[0] | {bodySize, truncated, body_len: (.body | length)}'
# {
#   "bodySize": 5000,        ← original size
#   "truncated": true,
#   "body_len": 1368         ← base64 of the first 1024 bytes
# }
```

## FIFO Eviction Example

Once a bin reaches `maxRequestsPerBin` captures (100 by default), the oldest
ones are dropped:

```bash
# Send 105 requests
for i in $(seq 1 105); do
  curl -s -X POST "http://localhost:3000/b/$ID/event/$i" > /dev/null
done

# The bin holds the most recent 100; the first 5 are gone
curl -s "http://localhost:3000/bins/$ID/requests" | jq '.requests | length'
# 100

# Newest is at the top
curl -s "http://localhost:3000/bins/$ID/requests" | jq '.requests[0].path'
# "/event/105"
```

## Programmatic Access

The bin manager is exposed on the `MockHttp` instance as `mock.bins`. This
makes it easy to drive bins from a test suite without going through HTTP:

```javascript
import { MockHttp } from '@jaredwray/mockhttp';

const mock = new MockHttp({ logging: false });
await mock.start();

// Create a bin
const bin = mock.bins.createBin();
console.log(`Webhook target: http://localhost:${mock.port}/b/${bin.id}`);

// ... point your code-under-test at that URL ...

// Read captured requests (newest first)
const requests = mock.bins.getRequests(bin.id);
console.log(`Captured ${requests.length} requests`);

for (const req of requests) {
  console.log(`${req.method} ${req.path} (${req.bodySize} bytes)`);
}

// Clean up
mock.bins.deleteBin(bin.id);
await mock.close(); // also stops the bin cleanup timer
```

### Using Bins in a Vitest Test

```typescript
import { afterAll, beforeAll, expect, test } from 'vitest';
import { MockHttp } from '@jaredwray/mockhttp';

let mock: MockHttp;

beforeAll(async () => {
  mock = new MockHttp({ logging: false });
  await mock.start();
});

afterAll(async () => {
  await mock.close();
});

test('my SDK sends the right webhook payload', async () => {
  const bin = mock.bins.createBin();
  const webhookUrl = `http://localhost:${mock.port}/b/${bin.id}`;

  // Drive your SDK at the bin
  await mySdk.notify(webhookUrl, { event: 'user.created', id: 42 });

  // Assert on what actually arrived
  const [captured] = mock.bins.getRequests(bin.id);
  expect(captured.method).toBe('POST');
  expect(captured.contentType).toBe('application/json');
  expect(JSON.parse(captured.body!)).toEqual({
    event: 'user.created',
    id: 42,
  });
  expect(captured.headers['x-signature']).toBeDefined();
});
```

## Configuration

Bins are enabled by default. To disable the routes entirely:

```javascript
const mock = new MockHttp({
  httpBin: { bins: false },
});
```

To tune limits, replace the default `BinManager` before starting:

```javascript
import { MockHttp, BinManager } from '@jaredwray/mockhttp';

const mock = new MockHttp();
mock.bins = new BinManager({
  defaultTtlMs: 60 * 60 * 1000,    // 1 hour (default: 24h)
  maxRequestsPerBin: 500,           // (default: 100)
  maxBodySize: 5 * 1024 * 1024,     // 5 MiB (default: 1 MiB)
  idLength: 16,                     // (default: 12)
  cleanupIntervalMs: 30 * 1000,     // sweep every 30s (default: 60s)
});

await mock.start();
```

### Defaults

| Option | Default | Description |
|--------|---------|-------------|
| `defaultTtlMs` | `86400000` (24h) | Bin lifetime. Expired bins return 404 and are lazily removed. |
| `maxRequestsPerBin` | `100` | When exceeded, oldest captures are dropped (FIFO). |
| `maxBodySize` | `1048576` (1 MiB) | Larger bodies are truncated; `truncated: true` is set on the capture. |
| `idLength` | `12` | Length of generated bin and request ids. |
| `cleanupIntervalMs` | `60000` (1 min) | How often expired bins are swept. The timer is `unref()`'d so it never keeps the process alive. |

### Pluggable Storage

`BinManager` accepts a `store: BinStore` so you can plug in alternative
backends (Redis, SQLite, etc.) without changing the rest of the codebase. The
default `InMemoryBinStore` keeps state in process memory.

```typescript
import {
  BinManager,
  InMemoryBinStore,
  type Bin,
  type BinStore,
  type CapturedRequest,
} from '@jaredwray/mockhttp';

class RedisBinStore implements BinStore {
  createBin(bin: Bin): void { /* SET bin:${bin.id} ... */ }
  getBin(id: string): Bin | undefined { /* GET ... */ }
  listBins(): Bin[] { /* SCAN ... */ }
  deleteBin(id: string): boolean { /* DEL ... */ }
  addRequest(binId: string, req: CapturedRequest, max: number): void {
    /* LPUSH bin:${binId}:requests + LTRIM to max */
  }
  getRequests(binId: string): CapturedRequest[] { /* LRANGE ... */ }
  getRequest(binId: string, reqId: string): CapturedRequest | undefined { /* ... */ }
  clearRequests(binId: string): void { /* DEL bin:${binId}:requests */ }
  cleanupExpired(now: number): string[] { /* scan + delete */ return []; }
}

mock.bins = new BinManager({ store: new RedisBinStore() });
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

# Flexible URL Matching

MockHttp ignores trailing path segments that come after the parsable portion of a URL. This is useful when a client appends extra data to a known endpoint — instead of returning 404, MockHttp serves the closest matching route.

For example, all of these are served by `/status/:code`:

```
GET /status/429
GET /status/429/
GET /status/429/foo
GET /status/429/foo/bar
```

The rewrite preserves the query string and only triggers when a more specific route exists; URLs whose first path segment doesn't correspond to a registered route still return 404.

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
    - `bins?`: boolean - Enable request bin routes /bins and /b/:id (default: true)
  - `https?`: boolean | HttpsOptions - Enable HTTPS with auto-generated or custom certificates (default: undefined/disabled)
  - `http2?`: boolean - Enable HTTP/2 support (default: false)
  - `http1?`: boolean - Allow HTTP/1.1 fallback when using HTTP/2 with HTTPS (default: true)
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
- `https`: HttpsOptions | undefined - Get/set HTTPS configuration
- `isHttps`: boolean - Whether the server is running with HTTPS
- `http2`: boolean - Get/set HTTP/2 support
- `http1`: boolean - Get/set HTTP/1.1 fallback for HTTP/2 with HTTPS
- `server`: FastifyInstance - Get/set the Fastify server instance
- `taps`: TapManager - Get/set the TapManager instance
- `bins`: BinManager - Get/set the BinManager instance for request bins

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

#### `async registerBinRoutes(fastifyInstance?)`

Register the request bin routes — management at `/bins` and capture at `/b/:id`.

## Bins (Request Capture)

Access the BinManager via `mockHttp.bins` to manage request bins programmatically. See [Request Bins](#request-bins) for usage examples.

### `bins.createBin()`

Create a new bin with the configured TTL.

**Returns:** `Bin` — `{ id, createdAt, expiresAt, requestCount }`

### `bins.getBin(id)`

Look up a bin by id. Returns `undefined` if the bin does not exist or has expired (and lazily removes the expired entry).

**Returns:** `Bin | undefined`

### `bins.listBins()`

List all non-expired bins.

**Returns:** `Bin[]`

### `bins.deleteBin(id)`

Delete a bin and all its captured requests.

**Returns:** `boolean` — `true` if the bin existed

### `bins.getRequests(binId)`

List captured requests for a bin, newest first.

**Returns:** `CapturedRequest[]`

### `bins.getRequest(binId, reqId)`

Look up a single captured request.

**Returns:** `CapturedRequest | undefined`

### `bins.clearRequests(binId)`

Clear all captured requests in a bin (the bin itself is preserved).

### `bins.recordRequest(binId, raw)`

Manually record a captured request. Returns `undefined` if the bin does not exist or is expired. Normally invoked by the capture route, but available for programmatic use.

**Returns:** `CapturedRequest | undefined`

### `bins.start()` / `bins.stop()`

Start or stop the periodic cleanup of expired bins. `MockHttp.start()` and `MockHttp.close()` call these automatically. The interval is `unref()`'d so it never keeps the Node process alive.

### `bins.maxBodySize` / `bins.maxRequestsPerBin` / `bins.defaultTtlMs`

Read-only getters for the currently-configured limits.

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
