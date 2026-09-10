import * as fs from "node:fs/promises";
import * as os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { afterEach, describe, expect, test } from "vitest";
import { MockHttp } from "../src/mock-http.js";

const fixtureSiteDist = path.resolve("./test/fixtures/site-dist");
const missingSiteDist = path.resolve("./test/fixtures/missing-site-dist");
const packageSiteDist = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../site/dist",
);

describe("Docula site docs", () => {
	const servers: MockHttp[] = [];

	afterEach(async () => {
		await Promise.all(servers.splice(0).map((mock) => mock.close()));
	});

	test("should default siteDistPath to the package site/dist directory", () => {
		const mock = new MockHttp();
		expect(mock.siteDistPath).toBe(packageSiteDist);
		mock.siteDistPath = "./tmp-site-dist";
		expect(mock.siteDistPath).toBe(path.resolve("./tmp-site-dist"));
	});

	test("should keep the default siteDistPath independent of cwd", () => {
		const originalCwd = process.cwd();
		process.chdir(os.tmpdir());
		try {
			expect(new MockHttp().siteDistPath).toBe(packageSiteDist);
			expect(new MockHttp().siteDistPath).not.toBe(path.resolve("./site/dist"));
		} finally {
			process.chdir(originalCwd);
		}
	});

	test("should accept siteDistPath in constructor options", () => {
		const mock = new MockHttp({ siteDistPath: fixtureSiteDist });
		expect(mock.siteDistPath).toBe(fixtureSiteDist);
	});

	test("should serve the Docula site when apiDocs is enabled", async () => {
		const mock = new MockHttp({
			logging: false,
			rateLimit: false,
			port: 4010,
			siteDistPath: fixtureSiteDist,
		});
		servers.push(mock);
		await mock.start();

		const home = await mock.server.inject({ method: "GET", url: "/" });
		expect(home.statusCode).toBe(200);
		expect(home.headers["content-type"]).toContain("text/html");
		expect(home.payload).toContain("MockHTTP Docs Fixture");

		const docs = await mock.server.inject({ method: "GET", url: "/docs/" });
		expect(docs.statusCode).toBe(200);
		expect(docs.payload).toContain("Documentation Fixture");

		const api = await mock.server.inject({ method: "GET", url: "/api/" });
		expect(api.statusCode).toBe(200);
		expect(api.payload).toContain("API Fixture");

		const sitemap = await mock.server.inject({
			method: "GET",
			url: "/sitemap.xml",
		});
		expect(sitemap.statusCode).toBe(200);
		expect(sitemap.headers["content-type"]).toContain("application/xml");
		expect(sitemap.payload).toContain("http://localhost:80/");
		expect(sitemap.payload).not.toContain("https://mockhttp.org");

		const forwarded = await mock.server.inject({
			method: "GET",
			url: "/sitemap.xml",
			headers: {
				host: "docs.example.test",
				"x-forwarded-proto": "https",
			},
		});
		expect(forwarded.statusCode).toBe(200);
		expect(forwarded.payload).toContain("https://docs.example.test/");

		const get = await mock.server.inject({ method: "GET", url: "/get" });
		expect(get.statusCode).toBe(200);
		expect(get.json()).toMatchObject({ method: "GET" });
	});

	test("should serve a live OpenAPI document at /openapi.json", async () => {
		const mock = new MockHttp({
			logging: false,
			rateLimit: false,
			port: 4011,
			siteDistPath: fixtureSiteDist,
		});
		servers.push(mock);
		await mock.start();

		const response = await mock.server.inject({
			method: "GET",
			url: "/openapi.json",
		});
		expect(response.statusCode).toBe(200);
		const spec = response.json();
		expect(spec.openapi).toMatch(/^3\./);
		expect(spec.info.title).toBe("Mock HTTP API");
		expect(spec.paths["/get"]).toBeDefined();
		expect(spec.servers).toEqual([
			expect.objectContaining({ url: "", description: "This instance" }),
		]);
	});

	test("should not serve the site when apiDocs is disabled", async () => {
		const mock = new MockHttp({
			logging: false,
			rateLimit: false,
			apiDocs: false,
			port: 4012,
			siteDistPath: fixtureSiteDist,
		});
		servers.push(mock);
		await mock.start();

		const home = await mock.server.inject({ method: "GET", url: "/" });
		expect(home.statusCode).toBe(404);

		const openapi = await mock.server.inject({
			method: "GET",
			url: "/openapi.json",
		});
		expect(openapi.statusCode).toBe(404);

		const get = await mock.server.inject({ method: "GET", url: "/get" });
		expect(get.statusCode).toBe(200);
	});

	test("should skip static docs when the site directory is missing", async () => {
		const mock = new MockHttp({
			logging: false,
			rateLimit: false,
			port: 4013,
			siteDistPath: missingSiteDist,
		});
		servers.push(mock);
		await mock.start();

		const home = await mock.server.inject({ method: "GET", url: "/" });
		expect(home.statusCode).toBe(404);

		const openapi = await mock.server.inject({
			method: "GET",
			url: "/openapi.json",
		});
		expect(openapi.statusCode).toBe(200);
		expect(openapi.json().paths["/get"]).toBeDefined();

		const get = await mock.server.inject({ method: "GET", url: "/get" });
		expect(get.statusCode).toBe(200);
	});

	test("registerApiDocs should register swagger and the site on a custom instance", async () => {
		const app = Fastify({ logger: false });
		expect(app.hasReplyDecorator("sendFile")).toBe(false);
		const mock = new MockHttp({ siteDistPath: fixtureSiteDist });
		await mock.registerApiDocs(app);

		expect(app.hasReplyDecorator("sendFile")).toBe(true);

		const home = await app.inject({ method: "GET", url: "/" });
		expect(home.statusCode).toBe(200);
		expect(home.payload).toContain("MockHTTP Docs Fixture");

		const openapi = await app.inject({ method: "GET", url: "/openapi.json" });
		expect(openapi.statusCode).toBe(200);
		expect(openapi.json().paths["/sitemap.xml"]).toBeUndefined();

		await app.close();
	});

	test("registerSite should skip sitemap rewrite when sitemap.xml is absent", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mockhttp-site-"));
		await fs.writeFile(path.join(dir, "index.html"), "<html>no sitemap</html>");
		const app = Fastify({ logger: false });
		const mock = new MockHttp({ siteDistPath: dir });
		await mock.registerSite(app);

		const home = await app.inject({ method: "GET", url: "/" });
		expect(home.statusCode).toBe(200);

		const sitemap = await app.inject({ method: "GET", url: "/sitemap.xml" });
		expect(sitemap.statusCode).toBe(404);

		await app.close();
		await fs.rm(dir, { recursive: true, force: true });
	});

	test("registerSite should no-op when the directory does not exist", async () => {
		const app = Fastify({ logger: false });
		const mock = new MockHttp({ siteDistPath: missingSiteDist });
		await mock.registerSite(app);

		const home = await app.inject({ method: "GET", url: "/" });
		expect(home.statusCode).toBe(404);

		await app.close();
	});
});
