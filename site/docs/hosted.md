---
title: MockHttp.org Live
order: 8
---

# About mockhttp.org

[mockhttp.org](https://mockhttp.org) is a free hosted instance of this codebase for testing. It runs on a [Cloudflare Worker](/docs/how-to-deploy/cloudflare/) (no containers): documentation is served from Workers Assets, and mock APIs such as `/get` and `/post` run in the Worker. The service is globally available and rate-limited (1000 requests per minute per IP) to prevent abuse.

All [mockhttp.org](https://mockhttp.org) traffic stays on Cloudflare. A separate test app runs the Node server on [Wasmer Edge](/docs/how-to-deploy/wasmer/) at [mockhttp.wasmer.app](https://mockhttp.wasmer.app).

Getting Started is served at `/` and `/docs`, other guides at `/docs/...`, and the interactive HTTP API reference at `/api`. Mock endpoints such as `/get` and `/post` are unchanged.
