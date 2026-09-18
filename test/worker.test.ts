import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { readPublicFile, setPublicFileReader } from "../src/public-files.js";
import {
	applyRateLimit,
	bindPublicAssets,
	clientIp,
	createWorkerApp,
	handleWorkerFetch,
	headersFromInject,
	injectWorkerRequest,
	responseFromInject,
	WORKER_PORT,
	workerMockHttpOptions,
} from "../worker/app.js";

const { default: worker } = await import("../worker/index.js");

describe("cloudflare worker", () => {
	const appPromise = createWorkerApp();

	beforeAll(async () => {
		await appPromise;
	});

	afterAll(async () => {
		await (await appPromise).close();
	});

	afterEach(() => {
		setPublicFileReader();
	});

	it("runs Fastify in the Worker without containers", () => {
		expect(WORKER_PORT).toBe(3000);
		expect(workerMockHttpOptions).toMatchObject({
			port: 3000,
			host: "127.0.0.1",
			logging: false,
			autoDetectPort: false,
			staticFiles: false,
			rateLimit: false,
			pluginTimeout: 0,
			startBins: false,
			siteDistPath: "/__mockhttp_worker_no_site__",
		});
	});

	it("prefers the Cloudflare connecting IP", () => {
		const request = new Request("https://mockhttp.org/ip", {
			headers: {
				"cf-connecting-ip": "203.0.113.10",
				"x-forwarded-for": "198.51.100.2, 192.0.2.1",
			},
		});
		expect(clientIp(request)).toBe("203.0.113.10");
	});

	it("falls back to the first forwarded IP and then unknown", () => {
		expect(
			clientIp(
				new Request("https://mockhttp.org/ip", {
					headers: { "x-forwarded-for": "198.51.100.2, 192.0.2.1" },
				}),
			),
		).toBe("198.51.100.2");
		expect(clientIp(new Request("https://mockhttp.org/ip"))).toBe("unknown");
	});

	it("skips rate limiting when no limiter binding is present", async () => {
		const response = await applyRateLimit(
			new Request("https://mockhttp.org/get"),
			{},
		);
		expect(response).toBeUndefined();
	});

	it("returns 429 when the Cloudflare rate limiter rejects the client", async () => {
		const limit = vi.fn().mockResolvedValue({ success: false });
		const app = await appPromise;
		const inject = vi.spyOn(app.server, "inject");
		const response = await handleWorkerFetch(
			new Request("https://mockhttp.org/get", {
				headers: { "cf-connecting-ip": "203.0.113.10" },
			}),
			{ RATE_LIMITER: { limit } },
			app,
		);

		expect(limit).toHaveBeenCalledWith({ key: "203.0.113.10" });
		expect(inject).not.toHaveBeenCalled();
		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("60");
		expect(await response.json()).toEqual({
			statusCode: 429,
			error: "Too Many Requests",
			message: "Rate limit exceeded, retry in 1 minute",
		});
		inject.mockRestore();
	});

	it("injects allowed requests into Fastify", async () => {
		const app = await appPromise;
		const limit = vi.fn().mockResolvedValue({ success: true });
		const response = await handleWorkerFetch(
			new Request("https://mockhttp.org/uuid", {
				headers: { "cf-connecting-ip": "203.0.113.10" },
			}),
			{ RATE_LIMITER: { limit } },
			app,
		);

		expect(limit).toHaveBeenCalledWith({ key: "203.0.113.10" });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			uuid: expect.any(String),
		});
	});

	it("binds public image fixtures from the Worker env", async () => {
		const fetchAsset = vi
			.fn()
			.mockResolvedValue(
				new Response(new Uint8Array([9, 8, 7]), { status: 200 }),
			);
		const app = await appPromise;

		await handleWorkerFetch(
			new Request("https://mockhttp.org/get"),
			{ ASSETS: { fetch: fetchAsset } },
			app,
		);

		const bytes = await readPublicFile("logo.png");
		expect(fetchAsset).toHaveBeenCalledWith("https://assets.local/logo.png");
		expect([...bytes]).toEqual([9, 8, 7]);
	});

	it("loads public image fixtures from Workers Assets", async () => {
		const fetchAsset = vi
			.fn()
			.mockResolvedValue(
				new Response(new Uint8Array([9, 8, 7]), { status: 200 }),
			);
		bindPublicAssets({ fetch: fetchAsset });

		const bytes = await readPublicFile("logo.png");
		expect(fetchAsset).toHaveBeenCalledWith("https://assets.local/logo.png");
		expect([...bytes]).toEqual([9, 8, 7]);
	});

	it("throws when a public asset is missing", async () => {
		bindPublicAssets({
			fetch: vi.fn().mockResolvedValue(new Response("nope", { status: 404 })),
		});
		await expect(readPublicFile("logo.png")).rejects.toThrow(
			"Public asset not found: logo.png",
		);
	});

	it("restores the filesystem reader when assets are not bound", async () => {
		bindPublicAssets({
			fetch: vi.fn().mockResolvedValue(new Response("x", { status: 200 })),
		});
		bindPublicAssets(undefined);
		const svg = await readPublicFile("logo.svg");
		expect(svg.toString("utf8")).toContain("<svg");
	});

	it("uses the Worker fetch handler against the startup Fastify app", async () => {
		const response = await worker.fetch(
			new Request("https://mockhttp.org/get"),
			{},
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ method: "GET" });
	});
});

describe("worker Fastify app", () => {
	it("serves mock endpoints without listening", async () => {
		const mockHttp = await createWorkerApp();
		expect(mockHttp.startBins).toBe(false);
		const response = await mockHttp.server.inject({
			method: "GET",
			url: "/get",
		});
		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({ method: "GET" });
		expect(mockHttp.server.server.listening).toBe(false);
		await mockHttp.close();
	});

	it("serves OpenAPI and image fixtures from the worker app", async () => {
		const mockHttp = await createWorkerApp();
		const spec = await mockHttp.server.inject({
			method: "GET",
			url: "/openapi.json",
		});
		expect(spec.statusCode).toBe(200);
		expect(spec.json()).toMatchObject({
			openapi: expect.any(String),
		});

		const image = await mockHttp.server.inject({
			method: "GET",
			url: "/image/png",
		});
		expect(image.statusCode).toBe(200);
		expect(image.headers["content-type"]).toBe("image/png");
		await mockHttp.close();
	});
});

describe("injectWorkerRequest", () => {
	it("dispatches GET, POST, HEAD, and empty-body statuses", async () => {
		const mockHttp = await createWorkerApp();

		const getResponse = await injectWorkerRequest(
			mockHttp,
			new Request("https://mockhttp.org/get?foo=bar"),
		);
		expect(getResponse.status).toBe(200);
		expect(await getResponse.json()).toMatchObject({
			method: "GET",
			queryParams: { foo: "bar" },
		});

		const postResponse = await injectWorkerRequest(
			mockHttp,
			new Request("https://mockhttp.org/post", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ hello: "world" }),
			}),
		);
		expect(postResponse.status).toBe(200);
		expect(await postResponse.json()).toMatchObject({
			method: "POST",
			body: { hello: "world" },
		});

		const headResponse = await injectWorkerRequest(
			mockHttp,
			new Request("https://mockhttp.org/get", { method: "HEAD" }),
		);
		expect(headResponse.status).toBe(200);
		expect(await headResponse.text()).toBe("");

		const noContent = await injectWorkerRequest(
			mockHttp,
			new Request("https://mockhttp.org/status/204"),
		);
		expect(noContent.status).toBe(204);
		expect(await noContent.text()).toBe("");

		await mockHttp.close();
	});

	it("sets Host from the request URL when the header is missing", async () => {
		const mockHttp = await createWorkerApp();
		const spy = vi.spyOn(mockHttp.server, "inject").mockResolvedValue({
			statusCode: 200,
			headers: { "content-type": "application/json" },
			rawPayload: Buffer.from("{}"),
			payload: "{}",
		} as never);

		await injectWorkerRequest(mockHttp, {
			url: "https://mockhttp.org/headers",
			method: "GET",
			headers: {
				forEach(callback: (value: string, key: string) => void) {
					callback("gzip", "accept-encoding");
				},
			},
			body: null,
		} as Request);

		expect(spy).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: {
					"accept-encoding": "gzip",
					host: "mockhttp.org",
				},
			}),
		);
		spy.mockRestore();
		await mockHttp.close();
	});
});

describe("inject response conversion", () => {
	it("omits hop-by-hop headers and flattens arrays", () => {
		const headers = headersFromInject({
			"x-empty": undefined,
			"set-cookie": ["a=1", "b=2"],
			"x-count": 3,
			"content-length": 12,
			"transfer-encoding": "chunked",
			connection: "keep-alive",
		});
		expect(headers.get("x-empty")).toBeNull();
		expect(headers.getSetCookie()).toEqual(["a=1", "b=2"]);
		expect(headers.get("x-count")).toBe("3");
		expect(headers.get("content-length")).toBeNull();
		expect(headers.get("transfer-encoding")).toBeNull();
		expect(headers.get("connection")).toBeNull();
	});

	it("maps informational statuses to 200 for the Fetch API", () => {
		const response = responseFromInject(
			"GET",
			100,
			{ "content-type": "application/json" },
			new Uint8Array([123, 125]),
		);
		expect(response.status).toBe(200);
		expect(responseFromInject("GET", 600, {}, new Uint8Array()).status).toBe(
			200,
		);
	});

	it("keeps 205 and 304 bodies empty", () => {
		expect(
			responseFromInject("GET", 205, {}, new Uint8Array([1])).body,
		).toBeNull();
		expect(
			responseFromInject("GET", 304, {}, new Uint8Array([1])).body,
		).toBeNull();
	});
});
