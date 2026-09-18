---
title: Getting Started
order: 1
---

# Getting Started

## Deploy via Docker
```bash
docker run -d -p 3000:3000 jaredwray/mockhttp
```

## Deploy via Docker Compose
```yaml
services:
  mockhttp:
    image: jaredwray/mockhttp:latest
    ports:
      - "3000:3000"
```

If you want to run it on a different port, just change the `3000` to whatever port you want and add in the environment variable `PORT` to the environment.

```yaml
services:
  mockhttp:
    image: jaredwray/mockhttp:latest
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
