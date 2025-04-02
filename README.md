[![public/logo.svg](public/logo.svg)](https://mockhttp.org)

[![tests](https://github.com/jaredwray/mockhttp/actions/workflows/tests.yaml/badge.svg)](https://github.com/jaredwray/mockhttp/actions/workflows/tests.yaml)
[![GitHub license](https://img.shields.io/github/license/jaredwray/mockhttp)](https://github.com/jaredwray/mockhttp/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/mockhttp/graph/badge.svg?token=eqtqoA3olU)](https://codecov.io/gh/jaredwray/mockhttp)
[![npm](https://img.shields.io/npm/dm/@jaredwray/mockhttp)](https://npmjs.com/package/@jaredwray/mockhttp)
[![npm](https://img.shields.io/npm/v/@jaredwray/mockhttp)](https://npmjs.com/package/@jaredwray/mockhttp)
[![Docker Pulls](https://img.shields.io/docker/pulls/jaredwray/mockhttp)](https://hub.docker.com/r/jaredwray/mockhttp)

A simple HTTP server that can be used to mock HTTP responses for testing purposes. Inspired by [httpbin](https://httpbin.org/) and built using `nodejs` and `fastify` with the idea of running it via https://mockhttp.org, via docker `jaredwray/mockhttp`, or nodejs `npm install jaredwray/mockhttp`.

# Features
* All the features of [httpbin](https://httpbin.org/)
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

# Deploy via NodeJS
```bash
npm install @jaredwray/mockhttp --save
```

then run `mockhttp` in your code.

```javascript
import { mockhttp } from '@jaredwray/mockhttp';
await mockhttp.start(); // start the server
const response = await fetch('http://localhost:3000/get');
console.log(reaponse);
await mockhttp.stop(); // stop the server
```

# About mockhttp.org 

[mockhttp.org](https://mockhttp.org) is a free service that runs this codebase and allows you to use it for testing purposes. It is a simple way to mock HTTP responses for testing purposes. It is globally available has some limitations on it to prevent abuse such as requests per second. It is ran via [Cloudflare](https://cloudflare.com) and [Google Cloud Run](https://cloud.google.com/run/) across 7 regions globally and can do millions of requests per second.

# Contributing

Please read our [CODE OF CONDUCT](CODE_OF_CONDUCT.md) and [CONTRIBUTING](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

# License

[MIT License & © Jared Wray](LICENSE)
