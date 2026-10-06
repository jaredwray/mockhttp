---
title: Cloudflare
order: 1
description: Deploy MockHTTP as a Cloudflare Worker. Workers Assets serve the docs site, and the Worker handles mock API routes.
---

# Deploy on Cloudflare

MockHTTP runs on Cloudflare as a Worker, not a container. [mockhttp.org](https://mockhttp.org) is this deployment: [Workers Assets](https://developers.cloudflare.com/workers/static-assets/) serve the documentation site, and the Worker handles mock APIs such as `/get` and `/post`.

The Worker entry is [`worker/index.ts`](https://github.com/jaredwray/mockhttp/blob/main/worker/index.ts). It listens with the Node.js compatibility layer and forwards requests into the Fastify app. Configuration lives in [`wrangler.jsonc`](https://github.com/jaredwray/mockhttp/blob/main/wrangler.jsonc).

## What the Worker does differently

The Worker starts the same MockHTTP app as Node.js, with a few options set for the Workers runtime:

| Option | Worker value | Why |
| --- | --- | --- |
| `rateLimit` | `false` | [`@fastify/rate-limit`](https://github.com/fastify/fastify-rate-limit) is off. A Cloudflare rate limiting binding allows 1000 requests per 60 seconds per IP. |
| `siteDistPath` | unused path | Fastify does not serve the docs. Workers Assets serve `site/dist`. |
| `staticFiles` | `false` | Logos and other `public/` files are copied into `site/dist` and read through the `ASSETS` binding. |
| `startBins` | `false` | The bin cleanup timer uses `setInterval`, which can hang a Worker isolate during startup. Bin routes still register. Expired bins are removed when that bin is read, not by a sweep of every bin. |
| `pluginTimeout` | `0` | Disables Fastify's plugin boot timeout. Those timers are unreliable on Workers. |
| `logging` | `false` | Request logging is off. |
| `autoDetectPort` | `false` | The app always listens on port 3000 inside the isolate. |

The rate limiter key is the `cf-connecting-ip` header, then the first address in `x-forwarded-for`, then `unknown`. A limited request returns `429` with `retry-after: 60`. That limiter is shared across isolates. Bins are not. The default store is in memory inside the isolate that handled the request, so a bin created on one request can be missing when another isolate or location handles the next one.

Taps are a library API (`mock.taps.inject`). They have no HTTP routes, so a deployed Worker has no way to inject one.

Assets are checked before the Worker. A file under `site/dist` (the docs site, favicon, logos) is served as a static asset. A path that is not a file, such as `/get` or `/post`, is handled by the Worker.

After the rate limiter, the Worker proxies a share of those requests to the [Wasmer](/docs/how-to-deploy/wasmer/) app instead of the Fastify app. `WASMER_TRAFFIC_PERCENT` in `wrangler.jsonc` sets the share (`10` in this repo), and `WASMER_ORIGIN` sets the target (`https://mockhttp.wasmer.app`). A hash of the client IP picks the backend, so each client stays on one. Set the Wrangler secret `WASMER_EDGE_TOKEN` to the same value as the Wasmer secret `EDGE_PROXY_TOKEN` so Wasmer rate-limits proxied clients by their own IP.

## Deploy your own Worker

You need a Cloudflare account and permission to deploy Workers. This repository pins Wrangler to `4.127.0`.

Change `name` and `routes` in `wrangler.jsonc` before you deploy a fork. The route in this repo attaches the custom domain `mockhttp.org`. `workers_dev` is enabled, so a `*.workers.dev` hostname is available as well. Adjust the `RATE_LIMITER` binding if you want a different limit than 1000 requests per 60 seconds. This repo's `WASMER_TRAFFIC_PERCENT` sends 10% of dynamic requests to `https://mockhttp.wasmer.app`. Set it to `0` to keep every request in your Worker, or point `WASMER_ORIGIN` at your own Wasmer app.

Also change `siteUrl` in `site/docula.config.ts`. The sitemap is a static file, and this repo sets it to `https://mockhttp.org`. The `migrations` block records a container class that this Worker no longer uses. A brand-new Worker can omit that block.

Wrangler bundles `worker/index.ts` from source, so you do not need `pnpm build` for this deploy. `pnpm website:build` produces `site/dist`.

```bash
pnpm install
pnpm website:build
pnpm prepare:worker-assets
npx wrangler@4.127.0 deploy
```

`pnpm prepare:worker-assets` copies `public/` into `site/dist` so favicon and logo files ship with the docs site. Wrangler reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the environment when you are not logged in locally.

After deploy, open the workers.dev hostname or your custom domain and request `/get`. The docs are at `/docs`, and the OpenAPI reference is at `/api`.

## Deploy from GitHub Actions

[`.github/workflows/deploy-site.yaml`](https://github.com/jaredwray/mockhttp/blob/main/.github/workflows/deploy-site.yaml) deploys this Worker on the `released` event (a published release, not a prerelease) and when the workflow is started by hand. The `production` environment provides `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The deploy job installs production dependencies, downloads the built site, copies `public/` into `site/dist`, installs Wrangler `4.127.0`, and runs `wrangler deploy`.

That workflow does not deploy the [Wasmer](/docs/how-to-deploy/wasmer/) app. Docker image publishing is a separate workflow, documented in [Docker](/docs/how-to-deploy/docker/).
