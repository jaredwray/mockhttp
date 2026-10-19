import { handleAsNodeRequest } from "cloudflare:node";
import KeyvMongo from "@keyv/mongo";
import Keyv from "keyv";
import { MockHttp, type MockHttpOptions } from "../src/mock-http.js";
import { MockHttpBins } from "../src/mock-http-bins.js";
import { setPublicFileReader } from "../src/public-files.js";

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
 * Pool stays small because each Worker isolate opens its own client.
 * `serverSelectionTimeoutMS` keeps a down Atlas from holding the request
 * for the driver's 30 second default.
 */
const workerBinMongoOptions = {
	collection: "bins",
	maxPoolSize: 5,
	minPoolSize: 0,
	serverSelectionTimeoutMS: 5_000,
};

/**
 * Atlas URI for this request. The Worker binding wins. An empty string is
 * treated as unset so a blank secret does not open a client.
 */
export function workerMongoUri(env: WorkerEnv = {}): string | undefined {
	const uri = env.MONGODB_URI || process.env.MONGODB_URI;
	if (!uri) {
		return undefined;
	}
	return uri;
}

/** Request bins stored in MongoDB through Keyv. */
export function createWorkerBins(uri: string): MockHttpBins {
	return new MockHttpBins({
		keyv: new Keyv({
			store: new KeyvMongo(uri, workerBinMongoOptions),
		}),
	});
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
	const uri = workerMongoUri(env);
	if (uri) {
		mockHttp.bins = createWorkerBins(uri);
	}
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
	const limited = await applyRateLimit(request, env);
	if (limited) {
		return limited;
	}

	bindPublicAssets(env.ASSETS);
	return dispatch(WORKER_PORT, request);
}
