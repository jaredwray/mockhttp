import { afterEach, describe, expect, it, vi } from "vitest";
import { readPublicFile, setPublicFileReader } from "../src/public-files.js";

const { handleAsNodeRequestMock, KeyvMongoMock } = vi.hoisted(() => {
	class KeyvMongoMock {
		static instances: KeyvMongoMock[] = [];
		readonly url: string;
		readonly options: Record<string, unknown> | undefined;
		readonly data = new Map<string, unknown>();

		constructor(
			url?: string | Record<string, unknown>,
			options?: Record<string, unknown>,
		) {
			if (KeyvMongoMock.failConstruct) {
				throw KeyvMongoMock.failConstruct;
			}
			if (typeof url === "string") {
				this.url = url;
				this.options = options;
			} else {
				this.url = "";
				this.options = url;
			}
			KeyvMongoMock.instances.push(this);
			if (KeyvMongoMock.failConnect) {
				this.connect = Promise.reject(KeyvMongoMock.failConnect);
				void this.connect.catch(() => undefined);
			} else if (KeyvMongoMock.resolveConnect) {
				this.connect = Promise.resolve("ok");
			}
			if (KeyvMongoMock.useDisconnect) {
				this.disconnect = async () => {
					KeyvMongoMock.disconnects += 1;
					if (KeyvMongoMock.failDisconnect) {
						throw new Error("disconnect failed");
					}
				};
			}
			if (KeyvMongoMock.useOn) {
				const listeners: Array<(error: unknown) => void> = [];
				this.on = (event, handler) => {
					if (event === "error") {
						listeners.push(handler);
					}
				};
				this.emitError = (error) => {
					for (const listener of listeners) {
						listener(error);
					}
				};
			}
		}

		async get(key: string): Promise<unknown> {
			if (KeyvMongoMock.failGet) {
				throw KeyvMongoMock.failGet;
			}
			return this.data.get(key);
		}

		async set(key: string, value: unknown): Promise<boolean> {
			if (KeyvMongoMock.failSet) {
				throw KeyvMongoMock.failSet;
			}
			if (KeyvMongoMock.failSetFalse) {
				return false;
			}
			this.data.set(key, value);
			return true;
		}

		async delete(key: string): Promise<boolean> {
			return this.data.delete(key);
		}

		async clear(): Promise<void> {
			this.data.clear();
		}

		async *iterator(): AsyncGenerator<[string, unknown]> {
			if (KeyvMongoMock.failIterator) {
				throw KeyvMongoMock.failIterator;
			}
			for (const entry of this.data) {
				yield entry;
			}
		}

		static failConstruct: Error | undefined;
		static failGet: Error | undefined;
		static failSet: Error | undefined;
		static failSetFalse = false;
		static failIterator: Error | undefined;
		static failConnect: Error | undefined;
		static resolveConnect = false;
		static useOn = false;
		static useDisconnect = true;
		static failDisconnect = false;
		static disconnects = 0;

		connect?: Promise<unknown>;
		on?: (event: string, handler: (error: unknown) => void) => void;
		emitError?: (error: unknown) => void;
		disconnect?: () => Promise<void>;
	}

	return {
		handleAsNodeRequestMock: vi.fn(),
		KeyvMongoMock,
	};
});

vi.mock("cloudflare:node", () => ({
	handleAsNodeRequest: handleAsNodeRequestMock,
}));

vi.mock("@keyv/mongo", () => ({
	default: KeyvMongoMock,
}));

const {
	WORKER_PORT,
	applyRateLimit,
	bindPublicAssets,
	clientIp,
	applyWorkerMongoEnv,
	createWorkerApp,
	handleWorkerFetch,
	listenWorkerApp,
	requestWithPublicProtocol,
	workerMockHttpOptions,
	workerMongoState,
	workerMongoUri,
	workerRuntime,
} = await import("../worker/app.js");
const { binStoreRuntime } = await import("../worker/bin-store.js");

const originalDispatch = workerRuntime.dispatch;

describe("cloudflare worker", () => {
	const dispatch = vi.fn();

	afterEach(() => {
		KeyvMongoMock.failConstruct = undefined;
		KeyvMongoMock.failGet = undefined;
		KeyvMongoMock.failSet = undefined;
		KeyvMongoMock.failSetFalse = false;
		KeyvMongoMock.failIterator = undefined;
		KeyvMongoMock.failConnect = undefined;
		KeyvMongoMock.resolveConnect = false;
		KeyvMongoMock.useOn = false;
		KeyvMongoMock.useDisconnect = true;
		KeyvMongoMock.failDisconnect = false;
		KeyvMongoMock.disconnects = 0;
		workerMongoState.uri = undefined;
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
		expect(dispatch).toHaveBeenCalledOnce();
		const forwarded = dispatch.mock.calls[0]?.[1] as Request;
		expect(dispatch.mock.calls[0]?.[0]).toBe(WORKER_PORT);
		expect(forwarded.url).toBe(request.url);
		expect(forwarded.headers.get("x-mockhttp-forwarded-proto")).toBe("https");
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
		expect(handleAsNodeRequestMock).toHaveBeenCalledOnce();
		const forwarded = handleAsNodeRequestMock.mock.calls[0]?.[1] as Request;
		expect(handleAsNodeRequestMock.mock.calls[0]?.[0]).toBe(WORKER_PORT);
		expect(forwarded.url).toBe(request.url);
		expect(forwarded.headers.get("x-mockhttp-forwarded-proto")).toBe("https");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
	});

	it("stamps the worker request scheme onto x-forwarded-proto", () => {
		const request = new Request("https://mockhttp.org/bins", {
			method: "POST",
		});
		const stamped = requestWithPublicProtocol(request);
		expect(stamped).not.toBe(request);
		expect(stamped.method).toBe("POST");
		expect(stamped.url).toBe(request.url);
		expect(stamped.headers.get("x-mockhttp-forwarded-proto")).toBe("https");
	});

	it("leaves a request alone when the public protocol header already matches", () => {
		const request = new Request("http://127.0.0.1/bins", {
			headers: { "x-mockhttp-forwarded-proto": "http" },
		});
		expect(requestWithPublicProtocol(request)).toBe(request);
	});

	it("replaces a public protocol header that disagrees with the request URL", () => {
		const request = new Request("https://mockhttp.org/bins", {
			headers: {
				"x-forwarded-proto": "http",
				"x-mockhttp-forwarded-proto": "http",
				"x-request-id": "abc",
			},
		});
		const stamped = requestWithPublicProtocol(request);
		expect(stamped.headers.get("x-mockhttp-forwarded-proto")).toBe("https");
		expect(stamped.headers.get("x-forwarded-proto")).toBe("http");
		expect(stamped.headers.get("x-request-id")).toBe("abc");
	});
});

describe("worker Fastify app", () => {
	afterEach(() => {
		KeyvMongoMock.failConstruct = undefined;
		KeyvMongoMock.failGet = undefined;
		KeyvMongoMock.failSet = undefined;
		KeyvMongoMock.failSetFalse = false;
		KeyvMongoMock.failIterator = undefined;
		KeyvMongoMock.failConnect = undefined;
		KeyvMongoMock.resolveConnect = false;
		KeyvMongoMock.useOn = false;
		KeyvMongoMock.useDisconnect = true;
		KeyvMongoMock.failDisconnect = false;
		KeyvMongoMock.disconnects = 0;
		workerMongoState.uri = undefined;
		delete process.env.MONGODB_URI;
	});

	it("serves mock endpoints without listening", async () => {
		const mockHttp = await createWorkerApp();
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

	it("serves bin routes from memory when no Atlas URI is configured", async () => {
		delete process.env.MONGODB_URI;
		KeyvMongoMock.instances.length = 0;
		expect(workerMongoUri()).toBeUndefined();
		expect(workerMongoUri({ MONGODB_URI: "" })).toBeUndefined();

		const mockHttp = await createWorkerApp({ MONGODB_URI: "" });
		const created = await mockHttp.server.inject({
			method: "POST",
			url: "/bins",
		});
		expect(created.statusCode).toBe(200);
		const id = created.json().id as string;
		const fetched = await mockHttp.server.inject({
			method: "GET",
			url: `/bins/${id}`,
		});
		expect(fetched.statusCode).toBe(200);
		expect(fetched.json()).toMatchObject({ id });
		expect(KeyvMongoMock.instances).toHaveLength(0);
		await mockHttp.close();
	});

	it("stores bins in MongoDB Atlas when MONGODB_URI is set", async () => {
		const uri = "mongodb+srv://user:pass@cluster.mongodb.net/mockhttp";
		KeyvMongoMock.instances.length = 0;
		process.env.MONGODB_URI = "mongodb://from-process-env";

		const mockHttp = await createWorkerApp({ MONGODB_URI: uri });
		// The client must not be constructed while the Worker isolate is starting.
		expect(KeyvMongoMock.instances).toHaveLength(0);
		const untouched = await mockHttp.server.inject({
			method: "GET",
			url: "/get",
		});
		expect(untouched.statusCode).toBe(200);
		expect(KeyvMongoMock.instances).toHaveLength(0);

		const created = await mockHttp.server.inject({
			method: "POST",
			url: "/bins",
		});
		expect(created.statusCode).toBe(200);
		const store = KeyvMongoMock.instances[0];
		expect(KeyvMongoMock.instances).toHaveLength(1);
		expect(store?.url).toBe(uri);
		expect(store?.options).toEqual({
			collection: "bins",
			maxPoolSize: 5,
			minPoolSize: 0,
			serverSelectionTimeoutMS: 5_000,
		});
		const id = created.json().id as string;
		expect(store?.data.size).toBeGreaterThan(0);

		const fetched = await mockHttp.server.inject({
			method: "GET",
			url: `/bins/${id}`,
		});
		expect(fetched.statusCode).toBe(200);
		expect(fetched.json()).toMatchObject({ id });

		const listed = await mockHttp.server.inject({
			method: "GET",
			url: "/bins",
		});
		expect(listed.statusCode).toBe(200);
		expect(listed.json().bins).toEqual(
			expect.arrayContaining([expect.objectContaining({ id })]),
		);

		const removed = await mockHttp.server.inject({
			method: "DELETE",
			url: `/bins/${id}`,
		});
		expect(removed.statusCode).toBe(204);
		await mockHttp.bins.keyv.clear();
		await mockHttp.close();
		delete process.env.MONGODB_URI;
	});

	it("reads the Atlas URI from process.env when the binding is unset", async () => {
		const uri = "mongodb+srv://user:pass@cluster.mongodb.net/mockhttp";
		process.env.MONGODB_URI = uri;
		KeyvMongoMock.instances.length = 0;

		expect(workerMongoUri({})).toBe(uri);
		const mockHttp = await createWorkerApp();
		expect(KeyvMongoMock.instances).toHaveLength(0);
		const created = await mockHttp.server.inject({
			method: "POST",
			url: "/bins",
		});
		expect(created.statusCode).toBe(200);
		expect(KeyvMongoMock.instances).toHaveLength(1);
		expect(KeyvMongoMock.instances[0]?.url).toBe(uri);
		await mockHttp.close();
		delete process.env.MONGODB_URI;
	});

	it("reports in-memory bin storage from /healthz", async () => {
		delete process.env.MONGODB_URI;
		const mockHttp = await createWorkerApp();
		const health = await mockHttp.server.inject({
			method: "GET",
			url: "/healthz",
		});
		expect(health.statusCode).toBe(200);
		expect(health.json()).toMatchObject({
			status: "ok",
			bins: {
				store: "memory",
				connected: true,
				uriPresent: false,
				scheme: null,
			},
		});
		expect(health.json().bins.latencyMs).toEqual(expect.any(Number));
		const spec = await mockHttp.server.inject({
			method: "GET",
			url: "/openapi.json",
		});
		expect(spec.json().paths["/healthz"]).toBeDefined();
		await mockHttp.close();
	});

	it("returns a redacted mongo ping failure from /healthz", async () => {
		const uri = "mongodb+srv://user:pass@cluster.mongodb.net/mockhttp";
		const ping = vi.spyOn(binStoreRuntime, "ping").mockResolvedValue({
			status: "error",
			bins: {
				store: "mongo",
				connected: false,
				uriPresent: true,
				scheme: "mongodb+srv",
				error: {
					name: "MongoServerSelectionError",
					message: "server selection failed",
					code: "ENOTFOUND",
				},
			},
		});
		const mockHttp = await createWorkerApp({ MONGODB_URI: uri });
		const health = await mockHttp.server.inject({
			method: "GET",
			url: "/healthz",
		});
		expect(ping).toHaveBeenCalledWith(uri);
		expect(health.statusCode).toBe(503);
		expect(health.json()).toMatchObject({
			status: "error",
			bins: {
				store: "mongo",
				connected: false,
				scheme: "mongodb+srv",
				uriPresent: true,
			},
		});
		expect(JSON.stringify(health.json())).not.toContain(uri);
		ping.mockRestore();
		await mockHttp.close();
	});

	it("uses the request MONGODB_URI when it differs from startup", async () => {
		const startup = "mongodb://user:startup-pass@cluster.mongodb.net/mockhttp";
		const requestUri =
			"mongodb+srv://user:request-pass@cluster.mongodb.net/mockhttp";
		const errorLog = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		KeyvMongoMock.instances.length = 0;
		const mockHttp = await createWorkerApp({ MONGODB_URI: startup });
		await handleWorkerFetch(
			new Request("https://mockhttp.org/bins"),
			{ MONGODB_URI: requestUri },
			vi.fn().mockResolvedValue(new Response("ok")),
		);
		const created = await mockHttp.server.inject({
			method: "POST",
			url: "/bins",
		});
		expect(created.statusCode).toBe(200);
		expect(KeyvMongoMock.instances[0]?.url).toBe(requestUri);
		const logged = errorLog.mock.calls
			.map((call) => String(call[0]))
			.join("\n");
		expect(logged).toContain("keyv.uri");
		expect(logged).toContain("mongodb+srv");
		expect(logged).not.toContain(startup);
		expect(logged).not.toContain(requestUri);
		expect(logged).not.toContain("startup-pass");
		expect(logged).not.toContain("request-pass");
		errorLog.mockRestore();
		await mockHttp.close();
	});

	it("logs and returns a safe message when Keyv cannot construct or write", async () => {
		const uri =
			"mongodb+srv://user:p@ssw!rd@cluster0.abcde.mongodb.net/mockhttp";
		const errorLog = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		KeyvMongoMock.failConstruct = new Error(`Invalid connection string ${uri}`);
		let mockHttp = await createWorkerApp({ MONGODB_URI: uri });
		const construct = await mockHttp.server.inject({
			method: "POST",
			url: "/bins",
		});
		expect(construct.statusCode).toBe(500);
		expect(construct.json().message).toContain("Invalid connection string");
		expect(construct.json().message).toContain("Percent-encode");
		expect(construct.body).not.toContain("p@ssw");
		expect(construct.body).not.toContain("cluster0");
		await mockHttp.close();

		KeyvMongoMock.failConstruct = undefined;
		KeyvMongoMock.failSet = Object.assign(
			new Error(`Invalid connection string ${uri}`),
			{ name: "MongoParseError", code: "PARSE" },
		);
		KeyvMongoMock.failConnect = KeyvMongoMock.failSet;
		KeyvMongoMock.failDisconnect = true;
		mockHttp = await createWorkerApp({ MONGODB_URI: uri });
		const saved = await mockHttp.server.inject({
			method: "POST",
			url: "/bins",
		});
		expect(saved.statusCode).toBe(500);
		expect(saved.json().message).toContain("could not save bin");
		expect(saved.json().message).toContain("Percent-encode");
		expect(saved.body).not.toContain(uri);
		expect(saved.body).not.toContain("p@ssw");
		const logged = errorLog.mock.calls
			.map((call) => String(call[0]))
			.join("\n");
		expect(logged).toContain("keyv.construct");
		expect(logged).toContain("keyv.connect");
		expect(logged).toContain("keyv.set");
		expect(logged).toContain("extraAt");
		expect(logged).not.toContain(uri);
		expect(logged).not.toContain("p@ssw");
		expect(KeyvMongoMock.disconnects).toBe(1);
		await mockHttp.close();

		KeyvMongoMock.failConnect = undefined;
		KeyvMongoMock.failSet = Object.assign(
			new Error("Invalid connection string"),
			{
				name: "MongoParseError",
			},
		);
		KeyvMongoMock.useDisconnect = false;
		mockHttp = await createWorkerApp({
			MONGODB_URI: "mongodb://user:pass@cluster.mongodb.net/mockhttp",
		});
		const noDisconnect = await mockHttp.server.inject({
			method: "POST",
			url: "/bins",
		});
		expect(noDisconnect.statusCode).toBe(500);
		expect(noDisconnect.body).toContain("Invalid connection string");
		expect(noDisconnect.body).not.toContain("user:pass");
		errorLog.mockRestore();
		await mockHttp.close();
	});

	it("logs a connected Keyv client and a false set", async () => {
		const uri = "mongodb://user:pass@cluster.mongodb.net:27017/mockhttp";
		const infoLog = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);
		const errorLog = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		KeyvMongoMock.resolveConnect = true;
		KeyvMongoMock.failSetFalse = true;
		const mockHttp = await createWorkerApp({ MONGODB_URI: uri });
		const saved = await mockHttp.server.inject({
			method: "POST",
			url: "/bins",
		});
		expect(saved.statusCode).toBe(500);
		await vi.waitFor(() => {
			expect(infoLog.mock.calls.join("\n")).toContain("keyv.connect");
		});
		expect(errorLog.mock.calls.join("\n")).toContain(
			"Keyv store set returned false",
		);
		expect(infoLog.mock.calls.join("\n")).not.toContain("user:pass");
		infoLog.mockRestore();
		errorLog.mockRestore();
		await mockHttp.close();
	});

	it("redacts iterator failures and forwards store error events", async () => {
		const uri = "mongodb+srv://user:pass@cluster.mongodb.net/mockhttp";
		const errorLog = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		KeyvMongoMock.failIterator = new Error(
			"iterator down mongodb://user:pass@cluster.mongodb.net/mockhttp",
		);
		const mockHttp = await createWorkerApp({ MONGODB_URI: uri });
		await mockHttp.server.inject({ method: "POST", url: "/bins" });
		const listed = await mockHttp.server.inject({
			method: "GET",
			url: "/bins",
		});
		expect(listed.statusCode).toBe(500);
		expect(listed.body).toContain("iterator down");
		expect(listed.body).not.toContain("user:pass");
		expect(listed.body).not.toContain("cluster.mongodb.net");
		await mockHttp.close();

		KeyvMongoMock.failIterator = undefined;
		KeyvMongoMock.useOn = true;
		KeyvMongoMock.instances.length = 0;
		const again = await createWorkerApp({ MONGODB_URI: uri });
		await again.server.inject({ method: "POST", url: "/bins" });
		const store = KeyvMongoMock.instances[0];
		const failure = Object.assign(new Error("querySrv ENOTFOUND"), {
			name: "MongoNetworkError",
			code: "ENOTFOUND",
		});
		expect(() => store?.emitError?.(failure)).toThrow(failure);
		expect(errorLog.mock.calls.join("\n")).toContain("keyv.error");
		expect(errorLog.mock.calls.join("\n")).not.toContain("user:pass");
		errorLog.mockRestore();
		await again.close();
	});

	it("leaves the mongo URI in place when the request omits it", () => {
		workerMongoState.uri = "mongodb://user:pass@cluster.mongodb.net/mockhttp";
		applyWorkerMongoEnv({});
		expect(workerMongoState.uri).toBe(
			"mongodb://user:pass@cluster.mongodb.net/mockhttp",
		);
		applyWorkerMongoEnv({ MONGODB_URI: workerMongoState.uri });
		expect(workerMongoState.uri).toContain("mongodb://");
	});
});
