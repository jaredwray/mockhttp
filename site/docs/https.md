---
title: HTTPS and HTTP/2
order: 3
---

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
