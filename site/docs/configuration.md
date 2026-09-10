---
title: Configuration
order: 6
---

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
