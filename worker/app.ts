import type { HTTPMethods } from "fastify";
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

const hopByHopHeaders = new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"content-length",
]);

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

export function headersFromInject(headers: Record<string, unknown>): Headers {
	const result = new Headers();
	for (const [key, value] of Object.entries(headers)) {
		if (value === undefined || hopByHopHeaders.has(key.toLowerCase())) {
			continue;
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				result.append(key, String(item));
			}
			continue;
		}

		result.set(key, String(value));
	}

	return result;
}

export function responseFromInject(
	method: string,
	statusCode: number,
	headers: Record<string, unknown>,
	rawPayload: Uint8Array,
): Response {
	const responseHeaders = headersFromInject(headers);
	const emptyBody =
		method === "HEAD" ||
		statusCode === 204 ||
		statusCode === 205 ||
		statusCode === 304;
	const status = statusCode >= 200 && statusCode <= 599 ? statusCode : 200;
	const body = emptyBody ? null : rawPayload;

	return new Response(body, {
		status,
		headers: responseHeaders,
	});
}

export async function injectWorkerRequest(
	app: MockHttp,
	request: Request,
): Promise<Response> {
	const url = new URL(request.url);
	const headers: Record<string, string> = {};
	request.headers.forEach((value, key) => {
		headers[key] = value;
	});
	if (!headers.host) {
		headers.host = url.host;
	}

	const method = request.method.toUpperCase();
	const payload =
		method === "GET" || method === "HEAD" || !request.body
			? undefined
			: Buffer.from(await request.arrayBuffer());

	const result = await app.server.inject({
		method: method as HTTPMethods,
		url: `${url.pathname}${url.search}`,
		headers,
		payload,
		remoteAddress: clientIp(request),
	});

	return responseFromInject(
		method,
		result.statusCode,
		result.headers as Record<string, unknown>,
		result.rawPayload,
	);
}

export async function handleWorkerFetch(
	request: Request,
	env: WorkerEnv,
	app: MockHttp,
): Promise<Response> {
	const limited = await applyRateLimit(request, env);
	if (limited) {
		return limited;
	}

	bindPublicAssets(env.ASSETS);
	return injectWorkerRequest(app, request);
}
