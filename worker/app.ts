import { handleAsNodeRequest } from "cloudflare:node";
import { MockHttp, type MockHttpOptions } from "../src/mock-http.js";
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
	startBins: false,
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
};

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

export async function createWorkerApp(): Promise<MockHttp> {
	const mockHttp = new MockHttp(workerMockHttpOptions);
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
