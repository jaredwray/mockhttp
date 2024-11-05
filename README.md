# mockhttp
A simple HTTP server that can be used to mock HTTP responses for testing purposes. Inspired by [httpbin](https://httpbin.org/) and built using `golang` with the idea of running it via https://mockhttp.org, via docker `jaredwray/mockhttp`, or nodejs `npm install -g mockhttp`.

# Deploy via Docker
```bash
docker run -d -p 8080:8080 jaredwray/mockhttp
```

# Deploy via NodeJS
```bash
npm install mockhttp --save
```

then run `mockhttp` in your code.

```javascript
import mockhttp from 'mockhttp';
mockhttp.start(); // start the server
const response = await fetch('http://localhost:8080/anything');
mockhttp.stop(); // stop the server
```

# About mockhttp.org 

[mockhttp.org](https://mockhttp.org) is a free service that runs this codebase and allows you to use it for testing purposes. It is a simple way to mock HTTP responses for testing purposes. It is globally available has some limitations on it to prevent abuse but many people will not see it. It is ran via [Cloudflare](https://cloudflare.com) and [Google Cloud Run](https://cloud.google.com/run/) across 7 regions globally.
