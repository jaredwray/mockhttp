---
title: Hosted Service
order: 8
---

# About mockhttp.org

[mockhttp.org](https://mockhttp.org) is a free hosted instance of this codebase for testing. It runs on a [Cloudflare Worker](https://developers.cloudflare.com/workers/) (no containers): documentation is served from Workers Assets, and mock APIs such as `/get` and `/post` run in the Worker. The service is globally available and rate-limited (1000 requests per minute per IP) to prevent abuse.

Getting Started is served at `/` and `/docs`, other guides at `/docs/...`, and the interactive HTTP API reference at `/api`. Mock endpoints such as `/get` and `/post` are unchanged.
