import { afterEach, describe, expect, it, vi } from "vitest";
import { readPublicFile, setPublicFileReader } from "../src/public-files.js";

const { handleAsNodeRequestMock } = vi.hoisted(() => ({
	handleAsNodeRequestMock: vi.fn(),
}));

vi.mock("cloudflare:node", () => ({
	handleAsNodeRequest: handleAsNodeRequestMock,
}));

const {
	WORKER_PORT,
	applyRateLimit,
	bindPublicAssets,
	clientIp,
	createWorkerApp,
	handleWorkerFetch,
	listenWorkerApp,
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
