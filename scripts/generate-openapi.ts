import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import "@fastify/swagger";
import { MockHttp } from "../src/mock-http.ts";
import { withLocalServer } from "../src/swagger.ts";

const mock = new MockHttp({ logging: false, rateLimit: false });
await mock.start();

const spec = withLocalServer(mock.server.swagger() as Record<string, unknown>);
const outDir = path.resolve("site/api");
await mkdir(outDir, { recursive: true });
await writeFile(
	path.join(outDir, "swagger.json"),
	`${JSON.stringify(spec, null, 2)}\n`,
);

await mock.close();
console.log(`Wrote OpenAPI spec to ${path.join(outDir, "swagger.json")}`);
