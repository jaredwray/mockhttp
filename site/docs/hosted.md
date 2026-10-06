---
title: MockHttp.org Live
order: 8
---

# About mockhttp.org

[mockhttp.org](https://mockhttp.org) is a free hosted instance of this codebase for testing. It runs on a [Cloudflare Worker](/docs/how-to-deploy/cloudflare/) (no containers): documentation is served from Workers Assets, and mock APIs such as `/get` and `/post` run in the Worker. The service is globally available and rate-limited (1000 requests per minute per IP) to prevent abuse.

The Worker proxies 10% of dynamic [mockhttp.org](https://mockhttp.org) requests to the Node server on [Wasmer Edge](/docs/how-to-deploy/wasmer/) at [mockhttp.wasmer.app](https://mockhttp.wasmer.app). A hash of the client IP keeps each client on one backend. Documentation requests stay on Workers Assets.

Getting Started is served at `/` and `/docs`, other guides at `/docs/...`, and the interactive HTTP API reference at `/api`. Mock endpoints such as `/get` and `/post` are unchanged.
