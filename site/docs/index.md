---
title: Documentation
order: 1
---

# Documentation

MockHTTP is an HTTP mock server and [httpbin](https://httpbin.org/) replacement. Use the hosted instance at [mockhttp.org](https://mockhttp.org), run it with Docker, or embed it in Node.js tests.

## Guides

- [Getting Started](/docs/getting-started/) — Docker, Compose, and Node.js
- [HTTPS and HTTP/2](/docs/https/) — TLS certificates and HTTP/2
- [Taps](/docs/taps/) — inject custom responses
- [Bins](/docs/bins/) — capture and inspect incoming requests
- [Configuration](/docs/configuration/) — rate limiting, logging, and URL matching
- [Library API](/docs/library/) — `MockHttp` class, options, and methods
- [Hosted Service](/docs/hosted/) — the free mockhttp.org instance

## HTTP API

The interactive HTTP API reference lives at [/api](/api/). Mock endpoints such as `/get`, `/post`, and `/status/:code` are unchanged.
