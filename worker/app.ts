import { handleAsNodeRequest } from "cloudflare:node";
import { logBinStore } from "../src/bin-store-diagnostics.js";
import { MockHttp, type MockHttpOptions } from "../src/mock-http.js";
import { MockHttpBins } from "../src/mock-http-bins.js";
import { setPublicFileReader } from "../src/public-files.js";
import { PUBLIC_PROTOCOL_HEADER } from "../src/routes/bins/management.js";
import { checkMemoryBinStore } from "../src/routes/health.js";
import { binStoreRuntime, createAdaptiveBinKeyv } from "./bin-store.js";

export const WORKER_PORT = 3000;

export const workerMockHttpOptions: MockHttpOptions = {
	port: WORKER_PORT,
	host: "127.0.0.1",
	logging: false,
	autoDetectPort: false,
	staticFiles: false,
	rateLimit: false,
	pluginTimeout: 0,
	siteDistPath: "/__mockhttp_worker_no_site__",
};

export type RateLimiter = {
	limit: (options: { key: string }) => Promise<{ success: boolean }>;
};

export type WorkerAssets = {
	fetch: (request: Request | URL | string) => Promise<Response>;
};

export type WorkerEnv = {
	ASSETS?: WorkerAssets;
	RATE_LIMITER?: RateLimiter;
	/** MongoDB Atlas connection string for shared request bins. */
	MONGODB_URI?: string;
};

/**
 * Atlas URI for this request. The Worker binding wins. An empty string is
 * treated as unset so a blank secret does not open a client.
 * The returned text is the env value. It is not trimmed, and no characters are added.
 */
export function workerMongoUri(env: WorkerEnv = {}): string | undefined {
	const uri = env.MONGODB_URI || process.env.MONGODB_URI;
	if (!uri) {
		return undefined;
	}
	return uri;
}

/**
 * URI the open bin client should use. Module startup records
 * `cloudflare:workers` env. Each request then replaces it with the fetch
 * handler env when that value is non-empty, so a startup snapshot cannot
 * stick a different string.
 */
export const workerMongoState: { uri: string | undefined } = { uri: undefined };

/** Apply a request's MONGODB_URI when it is set. Does not log the value. */
export function applyWorkerMongoEnv(env: WorkerEnv): void {
	const next = env.MONGODB_URI;
	if (!next || next === workerMongoState.uri) {
		return;
	}
	logBinStore({
		phase: "keyv.uri",
		store: "keyv-mongo",
		uri: next,
		error: new Error("MONGODB_URI changed for this isolate"),
	});
	workerMongoState.uri = next;
}

/** Request bins. MongoDB is used when a URI is configured, otherwise memory. */
export function createWorkerBins(): MockHttpBins {
	return new MockHttpBins({
		keyv: createAdaptiveBinKeyv(() => workerMongoState.uri),
	});
}

/**
 * The Node server inside the Worker is plain HTTP. workerd then rewrites
 * `x-forwarded-proto` to `http`, so Fastify cannot see the client scheme.
 * Stamp it on {@link PUBLIC_PROTOCOL_HEADER}, which the bridge leaves intact.
 */
export function requestWithPublicProtocol(request: Request): Request {
	const protocol = new URL(request.url).protocol.slice(0, -1);
	if (request.headers.get(PUBLIC_PROTOCOL_HEADER) === protocol) {
		return request;
	}

	const headers = new Headers(request.headers);
	headers.set(PUBLIC_PROTOCOL_HEADER, protocol);
	return new Request(request, { headers });
}

export type WorkerDispatch = (
	port: number,
	request: Request,
) => Promise<Response>;

export const workerRuntime: { dispatch: WorkerDispatch } = {
	dispatch: handleAsNodeRequest,
};

export function clientIp(request: Request): string {
	return (
		request.headers.get("cf-connecting-ip") ??
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		"unknown"
	);
}

export async function applyRateLimit(
	request: Request,
	env: WorkerEnv,
): Promise<Response | undefined> {
	if (!env.RATE_LIMITER) {
		return undefined;
	}

	const { success } = await env.RATE_LIMITER.limit({ key: clientIp(request) });
	if (success) {
		return undefined;
	}

	return new Response(
		JSON.stringify({
			statusCode: 429,
			error: "Too Many Requests",
			message: "Rate limit exceeded, retry in 1 minute",
		}),
		{
			status: 429,
			headers: {
				"content-type": "application/json; charset=utf-8",
				"retry-after": "60",
			},
		},
	);
}

export function bindPublicAssets(assets: WorkerAssets | undefined): void {
	if (!assets) {
		setPublicFileReader();
		return;
	}

	setPublicFileReader(async (file) => {
		const response = await assets.fetch(`https://assets.local/${file}`);
		if (!response.ok) {
			throw new Error(`Public asset not found: ${file}`);
		}
		return new Uint8Array(await response.arrayBuffer());
	});
}

export async function createWorkerApp(env: WorkerEnv = {}): Promise<MockHttp> {
	const mockHttp = new MockHttp(workerMockHttpOptions);
	workerMongoState.uri = workerMongoUri(env);
	mockHttp.bins = createWorkerBins();
	mockHttp.binHealthCheck = () => {
		const uri = workerMongoState.uri;
		if (!uri) {
			return checkMemoryBinStore(mockHttp.bins.keyv);
		}
		return binStoreRuntime.ping(uri);
	};
	await mockHttp.initialize();
	return mockHttp;
}

export async function listenWorkerApp(mockHttp: MockHttp): Promise<unknown> {
	return mockHttp.server.listen({
		port: mockHttp.port,
		host: mockHttp.host,
	});
}

export async function handleWorkerFetch(
	request: Request,
	env: WorkerEnv,
	dispatch: WorkerDispatch = workerRuntime.dispatch,
): Promise<Response> {
	applyWorkerMongoEnv(env);
	const limited = await applyRateLimit(request, env);
	if (limited) {
		return limited;
	}

	bindPublicAssets(env.ASSETS);
	return dispatch(WORKER_PORT, requestWithPublicProtocol(request));
}
