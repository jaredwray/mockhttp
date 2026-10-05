import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	EDGE_CLIENT_IP_HEADER,
	EDGE_TOKEN_HEADER,
} from "../src/edge-headers.js";
import { readPublicFile, setPublicFileReader } from "../src/public-files.js";

const { handleAsNodeRequestMock } = vi.hoisted(() => ({
	handleAsNodeRequestMock: vi.fn(),
}));

vi.mock("cloudflare:node", () => ({
	handleAsNodeRequest: handleAsNodeRequestMock,
}));

const {
	DEFAULT_WASMER_ORIGIN,
	DEFAULT_WASMER_TRAFFIC_PERCENT,
	WORKER_PORT,
	applyRateLimit,
	bindPublicAssets,
	clientIp,
	createWorkerApp,
	handleWorkerFetch,
	listenWorkerApp,
	proxyToWasmer,
	shouldProxyToWasmer,
	trafficBucket,
	trafficPercent,
	wasmerOrigin,
	workerMockHttpOptions,
	workerRuntime,
} = await import("../worker/app.js");

const originalDispatch = workerRuntime.dispatch;

describe("cloudflare worker", () => {
	const dispatch = vi.fn();

	afterEach(() => {
		dispatch.mockReset();
		dispatch.mockResolvedValue(new Response("ok", { status: 200 }));
		handleAsNodeRequestMock.mockReset();
		handleAsNodeRequestMock.mockResolvedValue(
			new Response("dispatched", { status: 200 }),
		);
		workerRuntime.dispatch = originalDispatch;
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
		const response = await handleWorkerFetch(
			new Request("https://mockhttp.org/get", {
				headers: { "cf-connecting-ip": "203.0.113.10" },
			}),
			{ RATE_LIMITER: { limit } },
			dispatch,
		);

		expect(limit).toHaveBeenCalledWith({ key: "203.0.113.10" });
		expect(dispatch).not.toHaveBeenCalled();
		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("60");
		expect(await response.json()).toEqual({
			statusCode: 429,
			error: "Too Many Requests",
			message: "Rate limit exceeded, retry in 1 minute",
		});
	});

	it("dispatches allowed requests to the Node HTTP server handler", async () => {
		const request = new Request("https://mockhttp.org/uuid");
		const expected = new Response("ok");
		dispatch.mockResolvedValue(expected);
		const limit = vi.fn().mockResolvedValue({ success: true });

		const response = await handleWorkerFetch(
			request,
			{ RATE_LIMITER: { limit } },
			dispatch,
		);

		expect(limit).toHaveBeenCalledWith({ key: "unknown" });
		expect(dispatch).toHaveBeenCalledWith(WORKER_PORT, request);
		expect(response).toBe(expected);
	});

	it("binds public image fixtures from the Worker env", async () => {
		const fetchAsset = vi
			.fn()
			.mockResolvedValue(
				new Response(new Uint8Array([9, 8, 7]), { status: 200 }),
			);

		await handleWorkerFetch(
			new Request("https://mockhttp.org/get"),
			{ ASSETS: { fetch: fetchAsset } },
			dispatch,
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

	it("uses the default worker runtime dispatcher", async () => {
		handleAsNodeRequestMock.mockResolvedValue(new Response("ok"));
		const request = new Request("https://mockhttp.org/ip");
		const response = await handleWorkerFetch(request, {});
		expect(handleAsNodeRequestMock).toHaveBeenCalledWith(WORKER_PORT, request);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
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

	it("listenWorkerApp binds the configured worker address", async () => {
		const mockHttp = await createWorkerApp();
		const spy = vi
			.spyOn(mockHttp.server, "listen")
			.mockResolvedValue("http://127.0.0.1:3000" as never);
		await listenWorkerApp(mockHttp);
		expect(spy).toHaveBeenCalledWith({
			port: WORKER_PORT,
			host: "127.0.0.1",
		});
		spy.mockRestore();
		await mockHttp.close();
	});
});

function ipFor(predicate: (bucket: number) => boolean): string {
	for (let n = 0; n < 100000; n++) {
		const ip = `198.51.${(n >> 8) & 255}.${n & 255}`;
		if (predicate(trafficBucket(ip))) {
			return ip;
		}
	}

	throw new Error("no matching ip");
}

describe("Wasmer traffic split", () => {
	const wasmerIp = ipFor((bucket) => bucket < DEFAULT_WASMER_TRAFFIC_PERCENT);
	const workerIp = ipFor((bucket) => bucket >= DEFAULT_WASMER_TRAFFIC_PERCENT);

	it("configures 10 percent of dynamic traffic for Wasmer", () => {
		const wrangler = readFileSync(
			new URL("../wrangler.jsonc", import.meta.url),
			"utf8",
		);
		expect(DEFAULT_WASMER_TRAFFIC_PERCENT).toBe(10);
		expect(wrangler).toContain(
			`"WASMER_TRAFFIC_PERCENT": "${DEFAULT_WASMER_TRAFFIC_PERCENT}"`,
		);
		expect(wrangler).toContain(`"WASMER_ORIGIN": "${DEFAULT_WASMER_ORIGIN}"`);
	});

	it("parses the traffic percent", () => {
		expect(trafficPercent(undefined)).toBe(0);
		expect(trafficPercent("")).toBe(0);
		expect(trafficPercent("  ")).toBe(0);
		expect(trafficPercent("nope")).toBe(0);
		expect(trafficPercent("Infinity")).toBe(0);
		expect(trafficPercent("-5")).toBe(0);
		expect(trafficPercent("0")).toBe(0);
		expect(trafficPercent("  10  ")).toBe(10);
		expect(trafficPercent("100")).toBe(100);
		expect(trafficPercent("150")).toBe(100);
	});

	it("keeps an empty bucket key stable", () => {
		expect(trafficBucket("")).toBeGreaterThanOrEqual(0);
		expect(trafficBucket("")).toBeLessThan(100);
		expect(trafficBucket(wasmerIp)).toBe(trafficBucket(wasmerIp));
	});

	it("resolves the Wasmer origin", () => {
		expect(wasmerOrigin({}).href).toBe(`${DEFAULT_WASMER_ORIGIN}/`);
		expect(wasmerOrigin({ WASMER_ORIGIN: "   " }).href).toBe(
			`${DEFAULT_WASMER_ORIGIN}/`,
		);
		expect(wasmerOrigin({ WASMER_ORIGIN: "not a url" }).href).toBe(
			`${DEFAULT_WASMER_ORIGIN}/`,
		);
		expect(
			wasmerOrigin({ WASMER_ORIGIN: "ftp://files.example/app" }).href,
		).toBe(`${DEFAULT_WASMER_ORIGIN}/`);
		expect(wasmerOrigin({ WASMER_ORIGIN: "http://127.0.0.1:9" }).href).toBe(
			"http://127.0.0.1:9/",
		);
		expect(
			wasmerOrigin({ WASMER_ORIGIN: "https://edge.example.test/base" }).href,
		).toBe("https://edge.example.test/base");
	});

	it("sends the same client to Wasmer and leaves the other clients on the Worker", async () => {
		const proxy = vi.fn(async () => new Response("wasmer"));
		const local = vi.fn(async () => new Response("worker"));
		const env = { WASMER_TRAFFIC_PERCENT: "10" };

		for (let attempt = 0; attempt < 2; attempt++) {
			const response = await handleWorkerFetch(
				new Request("https://mockhttp.org/get?x=1", {
					headers: { "cf-connecting-ip": wasmerIp },
				}),
				env,
				local,
				proxy,
			);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe("wasmer");
		}

		const stayed = await handleWorkerFetch(
			new Request("https://mockhttp.org/get", {
				headers: { "cf-connecting-ip": workerIp },
			}),
			env,
			local,
			proxy,
		);
		expect(await stayed.text()).toBe("worker");
		expect(proxy).toHaveBeenCalledTimes(2);
		expect(local).toHaveBeenCalledTimes(1);
		expect(
			shouldProxyToWasmer(
				new Request("https://mockhttp.org/get", {
					headers: { "cf-connecting-ip": workerIp },
				}),
				env,
			),
		).toBe(false);
	});

	it("keeps every dynamic request on the Worker at 0 percent", async () => {
		const proxy = vi.fn();
		const local = vi.fn(async () => new Response("worker"));
		const response = await handleWorkerFetch(
			new Request("https://mockhttp.org/get", {
				headers: { "cf-connecting-ip": wasmerIp },
			}),
			{ WASMER_TRAFFIC_PERCENT: "0" },
			local,
			proxy,
		);
		expect(await response.text()).toBe("worker");
		expect(proxy).not.toHaveBeenCalled();
	});

	it("proxies every dynamic request at 100 percent", async () => {
		const proxy = vi.fn(async () => new Response("wasmer"));
		const local = vi.fn();
		const response = await handleWorkerFetch(
			new Request("https://mockhttp.org/get"),
			{ WASMER_TRAFFIC_PERCENT: "150" },
			local,
			proxy,
		);
		expect(await response.text()).toBe("wasmer");
		expect(local).not.toHaveBeenCalled();
		expect(
			shouldProxyToWasmer(new Request("https://mockhttp.org/get"), {
				WASMER_TRAFFIC_PERCENT: "100",
			}),
		).toBe(true);
	});

	it("does not proxy a rate-limited request", async () => {
		const proxy = vi.fn();
		const local = vi.fn();
		const limit = vi.fn().mockResolvedValue({ success: false });
		const response = await handleWorkerFetch(
			new Request("https://mockhttp.org/get", {
				headers: { "cf-connecting-ip": wasmerIp },
			}),
			{ WASMER_TRAFFIC_PERCENT: "100", RATE_LIMITER: { limit } },
			local,
			proxy,
		);
		expect(response.status).toBe(429);
		expect(proxy).not.toHaveBeenCalled();
		expect(local).not.toHaveBeenCalled();
	});

	it("forwards the client to Wasmer and rewrites redirects", async () => {
		const proxy = vi.fn(async (request: Request) => {
			expect(request.url).toBe("https://mockhttp.wasmer.app/post?x=1");
			expect(request.method).toBe("POST");
			expect(request.redirect).toBe("manual");
			expect(request.headers.get("connection")).toBeNull();
			expect(request.headers.get("host")).toBeNull();
			expect(request.headers.get("x-forwarded-host")).toBe("mockhttp.org");
			expect(request.headers.get("x-forwarded-proto")).toBe("https");
			expect(request.headers.get("cf-connecting-ip")).toBe(wasmerIp);
			expect(request.headers.get(EDGE_CLIENT_IP_HEADER)).toBe(wasmerIp);
			expect(request.headers.get(EDGE_TOKEN_HEADER)).toBe("edge-secret");
			expect(request.headers.get("content-type")).toBe("text/plain");
			expect(await request.text()).toBe("hello");
			return new Response(null, {
				status: 302,
				statusText: "Found",
				headers: {
					location: "https://mockhttp.wasmer.app/next?y=2",
				},
			});
		});

		const response = await proxyToWasmer(
			new Request("https://mockhttp.org/post?x=1", {
				method: "POST",
				body: "hello",
				headers: {
					"content-type": "text/plain",
					connection: "close",
					"cf-connecting-ip": wasmerIp,
					[EDGE_CLIENT_IP_HEADER]: "1.2.3.4",
					[EDGE_TOKEN_HEADER]: "spoofed",
				},
			}),
			{
				WASMER_EDGE_TOKEN: "edge-secret",
			},
			proxy,
		);

		expect(response.status).toBe(302);
		expect(response.statusText).toBe("Found");
		expect(response.headers.get("location")).toBe(
			"https://mockhttp.org/next?y=2",
		);
	});

	it("rewrites relative Wasmer redirects onto the incoming host", async () => {
		const upstream = new Response(null, {
			status: 307,
			headers: { location: "/relative" },
		});
		const response = await proxyToWasmer(
			new Request("https://mockhttp.org:8443/get", {
				headers: { "cf-connecting-ip": wasmerIp },
			}),
			{ WASMER_ORIGIN: "http://127.0.0.1:9" },
			async () => upstream,
		);
		expect(response.headers.get("location")).toBe(
			"https://mockhttp.org:8443/relative",
		);
	});

	it("leaves foreign and invalid redirects unchanged", async () => {
		const foreign = new Response(null, {
			status: 302,
			headers: { location: "https://example.com/away" },
		});
		const invalid = new Response(null, {
			status: 302,
			headers: { location: "http://[" },
		});
		const plain = new Response("ok");
		const env = { WASMER_TRAFFIC_PERCENT: "100" };
		const request = new Request("https://mockhttp.org/get");

		expect(await proxyToWasmer(request, env, async () => foreign)).toBe(
			foreign,
		);
		expect(await proxyToWasmer(request, env, async () => invalid)).toBe(
			invalid,
		);
		expect(
			await proxyToWasmer(
				new Request("https://mockhttp.org/get", { method: "HEAD" }),
				env,
				async (outbound) => {
					expect(outbound.method).toBe("HEAD");
					expect(outbound.body).toBeNull();
					return plain;
				},
			),
		).toBe(plain);
	});

	it("drops a spoofed client ip when the Worker cannot see one", async () => {
		const proxy = vi.fn(async (request: Request) => {
			expect(request.method).toBe("POST");
			expect(request.body).toBeNull();
			expect(request.headers.get(EDGE_CLIENT_IP_HEADER)).toBeNull();
			expect(request.headers.get(EDGE_TOKEN_HEADER)).toBeNull();
			expect(request.headers.get("cf-connecting-ip")).toBeNull();
			return new Response("proxied");
		});

		const response = await proxyToWasmer(
			new Request("https://mockhttp.org/post", {
				method: "POST",
				headers: {
					[EDGE_CLIENT_IP_HEADER]: "1.2.3.4",
					[EDGE_TOKEN_HEADER]: "spoofed",
				},
			}),
			{},
			proxy,
		);
		expect(await response.text()).toBe("proxied");
	});

	it("does not bind Worker assets while proxying", async () => {
		const fetchAsset = vi.fn();
		const proxy = vi.fn(async () => new Response("wasmer"));
		const local = vi.fn();
		await handleWorkerFetch(
			new Request("https://mockhttp.org/get", {
				headers: { "cf-connecting-ip": wasmerIp },
			}),
			{
				WASMER_TRAFFIC_PERCENT: "100",
				ASSETS: { fetch: fetchAsset },
			},
			local,
			proxy,
		);
		expect(fetchAsset).not.toHaveBeenCalled();
		expect(local).not.toHaveBeenCalled();
	});

	it("uses fetch when no proxy is injected", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response("remote"));
		try {
			const response = await handleWorkerFetch(
				new Request("https://mockhttp.org/get", {
					headers: { "cf-connecting-ip": wasmerIp },
				}),
				{ WASMER_TRAFFIC_PERCENT: "100" },
			);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe("remote");
			expect(fetchMock).toHaveBeenCalledOnce();
		} finally {
			fetchMock.mockRestore();
		}
	});
});
