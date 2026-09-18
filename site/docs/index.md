---
title: Getting Started
order: 1
---

# Getting Started

[![tests](https://github.com/jaredwray/mockhttp/actions/workflows/tests.yaml/badge.svg)](https://github.com/jaredwray/mockhttp/actions/workflows/tests.yaml)
[![GitHub license](https://img.shields.io/github/license/jaredwray/mockhttp)](https://github.com/jaredwray/mockhttp/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/mockhttp/graph/badge.svg?token=eqtqoA3olU)](https://codecov.io/gh/jaredwray/mockhttp)
[![npm](https://img.shields.io/npm/dm/@jaredwray/mockhttp)](https://npmjs.com/package/@jaredwray/mockhttp)
[![npm](https://img.shields.io/npm/v/@jaredwray/mockhttp)](https://npmjs.com/package/@jaredwray/mockhttp)
[![GHCR](https://img.shields.io/badge/GHCR-mockhttp-blue)](https://github.com/jaredwray/mockhttp/pkgs/container/mockhttp)
[![mockhttp.org](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fjaredwray.com%2Fapi%2Fmockhttp-traffic&query=%24.message&label=mockhttp.org)](https://mockhttp.org)

A simple HTTP server for mocking responses in tests. Inspired by [httpbin](https://httpbin.org/) and built with Node.js and Fastify. Run it at [mockhttp.org](https://mockhttp.org), with Docker (`ghcr.io/jaredwray/mockhttp`), or in Node.js (`npm install @jaredwray/mockhttp`).

## Features

- All the features of [httpbin](https://httpbin.org/)
- [Taps](/docs/taps/) — inject custom responses for testing and development
- [Bins](/docs/bins/) — capture and inspect incoming HTTP requests (great for webhook debugging)
- `@fastify/helmet` built in by default
- Built with Node.js, TypeScript, and Fastify
- Deploy via Docker or Node.js
- Free hosted service at [mockhttp.org](https://mockhttp.org), running on Cloudflare
- Documentation site and interactive [OpenAPI reference](/api/)
- Auto-detect the next port that is not in use
- [HTTPS and HTTP/2](/docs/https/), plus [rate limiting, logging, and URL matching](/docs/configuration/)

## Deploy via Docker
```bash
docker run -d -p 3000:3000 ghcr.io/jaredwray/mockhttp
```

## Deploy via Docker Compose
```yaml
services:
  mockhttp:
    image: ghcr.io/jaredwray/mockhttp:latest
    ports:
      - "3000:3000"
```

If you want to run it on a different port, just change the `3000` to whatever port you want and add in the environment variable `PORT` to the environment.

```yaml
services:
  mockhttp:
    image: ghcr.io/jaredwray/mockhttp:latest
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
```

You can see an example of this in the [docker-compose.yaml](https://github.com/jaredwray/mockhttp/blob/main/docker-compose.yaml) file.

## Deploy via Node.js
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
