---
title: Taps
order: 4
---

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
