---
title: Docker
order: 2
description: Run MockHTTP from the jaredwray/mockhttp image, with Docker Compose, or by building the image from this repository.
---

# Deploy with Docker

The published image is [`jaredwray/mockhttp`](https://hub.docker.com/r/jaredwray/mockhttp) on Docker Hub. It runs the Node.js server and the documentation site in one container. The `latest` tag is `linux/amd64` only. Apple Silicon runs it under emulation. On arm64 Linux, build the image from this repository instead.

## Run the image

```bash
docker run -d -p 3000:3000 jaredwray/mockhttp
```

The server listens on port 3000. Open `http://localhost:3000/get` for a mock response, `http://localhost:3000/docs` for these guides, and `http://localhost:3000/api` for the OpenAPI reference.

`pnpm docker:run` is `docker run -p 3000:3000 jaredwray/mockhttp`. It stays in the foreground. Docker pulls the Hub image when it is not already local.

Rate limiting is on: 1000 requests per minute. The allow list is only `127.0.0.1` and `::1`. A published port delivers traffic from the Docker bridge address, not from loopback inside the container, so those requests count against the limit. None of the environment variables below turn it off. Change or disable it with the library [`rateLimit` option](/docs/configuration/). A test suite that sends more than 1000 requests a minute to the published port will get `429` responses.

## Docker Compose

```yaml
services:
  mockhttp:
    image: jaredwray/mockhttp:latest
    ports:
      - "3000:3000"
```

The Compose file in this repository publishes port 3001 and sets `PORT` so the process listens on that same port:

```yaml
services:
  mockhttp:
    image: jaredwray/mockhttp:latest
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
```

`pnpm docker:compose:up` and `pnpm docker:compose:down` call the `docker-compose` binary. Current Docker installs often provide `docker compose` instead, which you can run against the same file.

## Environment variables

The container starts `node dist/index.mjs`. That process reads these variables:

| Variable | Default | Effect |
| --- | --- | --- |
| `PORT` | `3000` | Port the server listens on. Match it to the published container port. |
| `HOST` | `0.0.0.0` | Bind address. |
| `LOGGING` | enabled | Set to `false` to turn logging off. |
| `HTTP2` | off | Set to `true` to enable HTTP/2 cleartext (h2c). The image does not load a TLS certificate. |
| `AUTO_DETECT_PORT` | `true` | Set to `false` to keep `PORT` even when that port is already in use. |

HTTPS certificates are configured in the [library](/docs/https/), not through container environment variables. Put a TLS proxy in front of the container when you need HTTPS.

## Build the image

The [`Dockerfile`](https://github.com/jaredwray/mockhttp/blob/main/Dockerfile) copies `node_modules`, `package.json`, `public/`, `dist/`, and `site/dist/` from the build context. Build the package and the docs site before `docker build`.

```bash
pnpm install
pnpm build
pnpm website:build
docker build -t jaredwray/mockhttp .
docker run -d -p 3000:3000 jaredwray/mockhttp
```

`pnpm docker:build` is the `docker build` step. The image is based on Node.js 24 Alpine, runs as the `node` user, exposes port 3000, and starts `node dist/index.mjs`.

## Publish to Docker Hub

[`.github/workflows/docker-publish.yaml`](https://github.com/jaredwray/mockhttp/blob/main/.github/workflows/docker-publish.yaml) runs on the `released` event (a published release, not a prerelease) and when the workflow is started by hand. It builds `jaredwray/mockhttp:<version>` and `jaredwray/mockhttp:latest` with `docker build` on `ubuntu-latest`, pushes both tags, and updates the Docker Hub description from `DOCKER.md`. That build is `linux/amd64`.

The same Node server can run on [Wasmer Edge](/docs/how-to-deploy/wasmer/). The public site at [mockhttp.org](https://mockhttp.org) is the [Cloudflare Worker](/docs/how-to-deploy/cloudflare/), not this image.
