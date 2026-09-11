---
title: Bins
order: 5
---

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
