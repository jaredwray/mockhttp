# Fastify-Fusion Migration Plan for MockHttp

This document outlines the migration plan for moving mockhttp from direct Fastify plugin management to using [fastify-fusion](https://github.com/jaredwray/fastify-fusion).

## Executive Summary

**fastify-fusion** is a framework that consolidates common Fastify plugins with sensible defaults, reducing boilerplate and dependency management overhead. Migrating mockhttp to use fastify-fusion will:

- Remove 7 direct dependencies
- Simplify server initialization code
- Gain additional features (CORS, caching) at no extra cost
- Reduce maintenance burden for plugin version updates

---

## Current State Analysis

### Current Dependencies (production)

| Package | Version | Status |
|---------|---------|--------|
| `@fastify/cookie` | ^11.0.2 | **KEEP** - Not in fastify-fusion |
| `@fastify/helmet` | ^13.0.2 | **REMOVE** - Provided by fastify-fusion |
| `@fastify/rate-limit` | ^10.3.0 | **REMOVE** - Provided by fastify-fusion |
| `@fastify/static` | ^9.0.0 | **REMOVE** - Provided by fastify-fusion |
| `@fastify/swagger` | ^9.6.1 | **REMOVE** - Provided by fastify-fusion |
| `@fastify/swagger-ui` | ^5.2.4 | **REMOVE** - Provided by fastify-fusion |
| `@scalar/api-reference` | ^1.43.1 | **KEEP** - Custom Scalar UI usage |
| `detect-port` | ^2.1.0 | **KEEP** - Not in fastify-fusion |
| `fastify` | ^5.6.2 | **KEEP** - Peer dependency of fastify-fusion |
| `hookified` | ^1.15.0 | **KEEP** - TapManager dependency |
| `html-escaper` | ^3.0.3 | **KEEP** - Route utility |
| `pino` | ^10.1.1 | **REMOVE** - Provided by fastify-fusion |
| `pino-pretty` | ^13.1.3 | **REMOVE** - Provided by fastify-fusion |

---

## Modules to Remove

After migration, the following dependencies can be **removed from package.json**:

```json
{
  "dependencies": {
    "@fastify/helmet": "^13.0.2",      // ❌ Remove
    "@fastify/rate-limit": "^10.3.0",  // ❌ Remove
    "@fastify/static": "^9.0.0",       // ❌ Remove
    "@fastify/swagger": "^9.6.1",      // ❌ Remove
    "@fastify/swagger-ui": "^5.2.4",   // ❌ Remove
    "pino": "^10.1.1",                 // ❌ Remove
    "pino-pretty": "^13.1.3"           // ❌ Remove
  }
}
```

**Total: 7 dependencies removed**

---

## Modules to Add

```json
{
  "dependencies": {
    "fastify-fusion": "^x.x.x"  // ✅ Add (replaces 7 packages)
  }
}
```

---

## Modules to Keep

```json
{
  "dependencies": {
    "@fastify/cookie": "^11.0.2",      // ✅ Keep - Cookie handling (not in fusion)
    "@scalar/api-reference": "^1.43.1", // ✅ Keep - Custom Scalar docs UI
    "detect-port": "^2.1.0",           // ✅ Keep - Auto port detection
    "fastify": "^5.6.2",               // ✅ Keep - Peer dependency
    "hookified": "^1.15.0",            // ✅ Keep - TapManager hooks
    "html-escaper": "^3.0.3"           // ✅ Keep - HTML escaping utility
  }
}
```

---

## Additional Features Gained

By migrating to fastify-fusion, mockhttp gains these features **for free**:

1. **CORS Support** (`@fastify/cors`) - Currently not available in mockhttp
2. **Built-in Caching** (`cacheable`) - Could be useful for response caching
3. **Unified Logger** - Standalone `logger()` function

---

## Migration Steps

### Phase 1: Preparation

1. **Create feature branch**
   ```bash
   git checkout -b feature/fastify-fusion-migration
   ```

2. **Install fastify-fusion**
   ```bash
   pnpm add fastify-fusion
   ```

3. **Run tests to establish baseline**
   ```bash
   pnpm test
   ```

### Phase 2: Code Changes

#### 2.1 Update `src/mock-http.ts`

**Remove imports:**
```typescript
// REMOVE these imports
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit, { type RateLimitPluginOptions } from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { fastifySwagger } from "@fastify/swagger";
```

**Add imports:**
```typescript
// ADD this import
import { fuse, type FuseOptions } from "fastify-fusion";
```

**Modify `start()` method:**

Replace manual plugin registration:
```typescript
// BEFORE: Manual registration
await this._server.register(fastifyHelmet, { ... });
await this._server.register(fastifyRateLimit, this._rateLimit);
await this._server.register(fastifyStatic, { ... });
await this._server.register(fastifySwagger, fastifySwaggerConfig);
```

With fastify-fusion:
```typescript
// AFTER: Using fastify-fusion
const fuseOptions: FuseOptions = {
  helmet: this._helmet ? {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  } : false,
  rateLimit: this._rateLimit ? {
    max: this._rateLimit.max ?? 1000,
    timeWindow: 60_000,  // 1 minute in ms
    allowList: this._rateLimit.allowList ?? ["127.0.0.1", "::1"],
  } : false,
  static: {
    dir: "./public",
    path: "/",
  },
  openApi: this._apiDocs ? {
    title: "Mock HTTP API",
    description: "...",
    version: pkg.version,
    docsRoutePath: "/docs",
  } : false,
  log: this._logging,
  cors: false,  // Disable CORS (not currently used)
  cache: false, // Disable caching (not currently used)
};

await fuse(this._server, fuseOptions);
```

#### 2.2 Handle Static File Edge Cases

MockHttp registers `@fastify/static` twice (for Scalar and public). Fastify-fusion handles one static directory. Options:

**Option A: Use fastify-fusion for public, manual for Scalar**
```typescript
// In fuseOptions
static: { dir: "./public", path: "/" }

// Manual registration for Scalar (after fuse())
await this._server.register(fastifyStatic, {
  root: path.resolve("./node_modules/@scalar/api-reference/dist"),
  prefix: "/scalar",
  decorateReply: false,
});
```

**Option B: Keep both manual (disable fusion's static)**
```typescript
static: false  // In fuseOptions

// Then register both manually (current behavior)
```

**Recommendation:** Option A - leverage fusion for public assets, manual for Scalar.

#### 2.3 Update `src/swagger.ts`

If using fastify-fusion's OpenAPI, this file may need updates or can be simplified:

```typescript
// The fastifySwaggerConfig can be removed if using fusion's openApi option
// Keep registerSwaggerUi for custom Swagger UI configuration
```

#### 2.4 Update/Remove `src/fastify-config.ts`

This file may become unnecessary if using fusion's logging:
- If keeping custom logging format → keep file
- If using fusion's defaults → remove file

**Recommendation:** Keep for now, can be removed in future cleanup.

### Phase 3: Update Types

Update `MockHttpOptions` to align with fastify-fusion types:

```typescript
import type { FuseOptions } from "fastify-fusion";

export type MockHttpOptions = {
  port?: number;
  host?: string;
  autoDetectPort?: boolean;
  helmet?: boolean | FuseOptions["helmet"];
  apiDocs?: boolean | FuseOptions["openApi"];
  httpBin?: HttpBinOptions;
  rateLimit?: boolean | FuseOptions["rateLimit"];
  hookOptions?: HookifiedOptions;
  logging?: boolean | FuseOptions["log"];
  // NEW: expose fusion options directly
  fuseOptions?: Partial<FuseOptions>;
};
```

### Phase 4: Update package.json

```json
{
  "dependencies": {
    "@fastify/cookie": "^11.0.2",
    "@scalar/api-reference": "^1.43.1",
    "detect-port": "^2.1.0",
    "fastify": "^5.6.2",
    "fastify-fusion": "^x.x.x",
    "hookified": "^1.15.0",
    "html-escaper": "^3.0.3"
  }
}
```

Remove from dependencies:
- `@fastify/helmet`
- `@fastify/rate-limit`
- `@fastify/static`
- `@fastify/swagger`
- `@fastify/swagger-ui`
- `pino`
- `pino-pretty`

### Phase 5: Testing

1. **Run full test suite**
   ```bash
   pnpm test
   ```

2. **Manual testing checklist:**
   - [ ] Server starts correctly
   - [ ] Security headers present (helmet)
   - [ ] Rate limiting works
   - [ ] Static files served (/favicon.ico, etc.)
   - [ ] API docs accessible (/docs)
   - [ ] Scalar UI works (/)
   - [ ] All HTTP method routes work
   - [ ] Cookies work
   - [ ] All httpbin features work

3. **Performance comparison:**
   ```bash
   # Before migration
   autocannon -c 100 -d 10 http://localhost:3000/get

   # After migration
   autocannon -c 100 -d 10 http://localhost:3000/get
   ```

### Phase 6: Cleanup

1. Remove unused imports
2. Remove `src/fastify-config.ts` if unused
3. Update documentation if needed
4. Update Docker build if needed

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Static file registration conflict | Medium | Test thoroughly, use Option A approach |
| CSP header differences | Low | Copy exact CSP config to fusion options |
| Rate limit behavior change | Low | Use same config values |
| Breaking API changes | Low | All routes remain unchanged |
| Performance regression | Low | Benchmark before/after |

---

## Rollback Plan

If issues arise:
1. Revert to previous commit
2. `pnpm install` to restore old dependencies
3. Deploy previous version

---

## Summary

### Before Migration
- **13 production dependencies**
- **Manual plugin registration** (~50 lines in start())
- **Separate config files** for logger, swagger

### After Migration
- **7 production dependencies** (6 fewer)
- **Single `fuse()` call** with options object
- **Simplified configuration**

### Files Changed
1. `src/mock-http.ts` - Main changes
2. `src/swagger.ts` - May simplify or remove
3. `src/fastify-config.ts` - May remove
4. `package.json` - Dependency updates

### New Capabilities Available
- CORS support (opt-in)
- Built-in caching (opt-in)
- Unified logger function
