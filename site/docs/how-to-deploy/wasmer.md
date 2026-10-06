---
title: Wasmer
order: 3
description: Deploy the MockHTTP Node.js server to Wasmer Edge with app.yaml, Anybuild, and wasmer deploy.
---

# Deploy on Wasmer

Wasmer Edge runs the same Node.js server as [Docker](/docs/how-to-deploy/docker/). The test app for this repository is [mockhttp.wasmer.app](https://mockhttp.wasmer.app).

This deploy does not publish the [Cloudflare Worker](/docs/how-to-deploy/cloudflare/). [mockhttp.org](https://mockhttp.org) stays on Cloudflare, and the Worker proxies 10% of its dynamic requests to [mockhttp.wasmer.app](https://mockhttp.wasmer.app). A hash of the client IP keeps each client on one backend.

## App configuration

[`app.yaml`](https://github.com/jaredwray/mockhttp/blob/main/app.yaml) describes the Edge app:

```yaml
kind: wasmer.io/App.v0
name: mockhttp
owner: jaredwray
package: .
env:
  HOST: "0.0.0.0"
  LOGGING: "false"
  AUTO_DETECT_PORT: "false"
```

`package: .` deploys the repository directory. `HOST` binds the server on all interfaces. Logging is off. Wasmer injects `PORT`. `AUTO_DETECT_PORT=false` keeps that port instead of scanning for another one.

Change `name` and `owner` before you deploy your own app. The environment variables are the same ones the Docker image reads (`PORT`, `HOST`, `LOGGING`, `HTTP2`, and `AUTO_DETECT_PORT`). See [Docker](/docs/how-to-deploy/docker/) for what each one does.

## Build with Anybuild

[`Anybuild`](https://github.com/jaredwray/mockhttp/blob/main/Anybuild) tells Wasmer how to build the package on a remote builder:

- Node.js 24 and pnpm `12.4.1`
- Build command: `pnpm run build && pnpm website:build`
- Start command: `node dist/index.mjs`

The build command produces `dist/` and `site/dist/` while Docula is still installed. Wasmer then prunes dev dependencies. The docs site has to exist before that prune, because Docula is a dev dependency.

## Deploy from the CLI

Install the [Wasmer CLI](https://docs.wasmer.io/install) and log in, then from the repository root:

```bash
wasmer deploy --build-remote
```

`--build-remote` uploads the source and runs the Anybuild file on Wasmer's builders. When the deploy finishes, the CLI prints the app URL.

## Deploy from GitHub Actions

[`.github/workflows/deploy-wasmer.yaml`](https://github.com/jaredwray/mockhttp/blob/main/.github/workflows/deploy-wasmer.yaml) runs on the `released` event (a published release, not a prerelease) and when the workflow is started by hand. The `wasmer` environment provides `WASMER_TOKEN`. The deploy step runs:

```bash
wasmer deploy --non-interactive --build-remote
```

## Runtime behavior

Bins use the default in-memory store, so a bin exists only on the instance that created it. Taps are a library API (`mock.taps.inject`) and have no HTTP routes, so a deployed app cannot inject one.

`@fastify/rate-limit` is on at 1000 requests per minute. It keys on the address that connects to the process. The server does not trust proxy headers, and the allow list is only `127.0.0.1` and `::1`. On the test app, `/ip` reports `127.0.0.100`, which is the edge proxy rather than the caller, and the response includes `x-ratelimit-limit: 1000`. Clients that share that proxy address share one limit on that instance. This is not the Cloudflare limiter used by [mockhttp.org](https://mockhttp.org).

Requests proxied by the [mockhttp.org](https://mockhttp.org) Worker can keep a per-client limit. Set the Wasmer secret `EDGE_PROXY_TOKEN` to the same value as the Worker secret `WASMER_EDGE_TOKEN`. When a request's `x-mockhttp-edge-token` header matches, the limiter keys on `x-mockhttp-client-ip` instead of the connecting address.

The process listens with HTTP. Wasmer terminates TLS for the `*.wasmer.app` hostname.
