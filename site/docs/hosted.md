---
title: Hosted Service
order: 8
---

# About mockhttp.org

[mockhttp.org](https://mockhttp.org) is a free hosted instance of this codebase for testing. It runs entirely on [Cloudflare](https://www.cloudflare.com/) using [Workers](https://developers.cloudflare.com/workers/) and [Containers](https://developers.cloudflare.com/containers/). The service is globally available and rate-limited (1000 requests per minute per IP) to prevent abuse.

The documentation homepage is served at `/`, markdown guides at `/docs`, and the interactive HTTP API reference at `/api`. Mock endpoints such as `/get` and `/post` are unchanged.
