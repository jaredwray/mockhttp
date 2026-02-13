# AGENTS.md

MockHTTP is an HTTP mock server for testing, built with Fastify and TypeScript.

## Commands

- `pnpm install` — install dependencies (always use pnpm, not npm)
- `pnpm build` — build the project
- `pnpm test` — run linter and tests with coverage
- `pnpm lint` — run Biome linter with auto-fixes

## Testing

- Framework: Vitest with `@vitest/coverage-v8`
- Tests are in the `test/` directory
- Linting: Biome (not ESLint or Prettier)

## After Making Changes

- Run `pnpm test` to ensure all tests pass
- Maintain 100% code coverage — add or update tests as needed
