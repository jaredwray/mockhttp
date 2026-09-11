---
title: Library API
order: 7
---

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
  - `apiDocs?`: boolean - Serve the Docula documentation site and OpenAPI spec (default: true)
  - `siteDistPath?`: string - Path to the built Docula site (default: the package `site/dist` directory)
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
- `apiDocs`: boolean - Get/set whether the documentation site and OpenAPI spec are served
- `siteDistPath`: string - Get/set the path to the built Docula site
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

Register OpenAPI generation and the Docula documentation site.

#### `async registerSwagger(fastifyInstance?)`

Register `@fastify/swagger` and the live `/openapi.json` spec route.

#### `async registerSite(fastifyInstance?)`

Serve the built Docula site from `siteDistPath` when the directory exists.

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
