import { handleAsNodeRequest } from "cloudflare:node";
import {
	EDGE_CLIENT_IP_HEADER,
	EDGE_TOKEN_HEADER,
} from "../src/edge-headers.js";
import { MockHttp, type MockHttpOptions } from "../src/mock-http.js";
import { setPublicFileReader } from "../src/public-files.js";

export const WORKER_PORT = 3000;
export const DEFAULT_WASMER_ORIGIN = "https://mockhttp.wasmer.app";
export const DEFAULT_WASMER_TRAFFIC_PERCENT = 10;

const HOP_BY_HOP_HEADERS = [
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"host",
];

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
	WASMER_ORIGIN?: string;
	WASMER_TRAFFIC_PERCENT?: string;
	WASMER_EDGE_TOKEN?: string;
};

export type WorkerDispatch = (
	port: number,
	request: Request,
) => Promise<Response>;

export type WorkerProxy = (request: Request) => Promise<Response>;

type OutboundRequestInit = RequestInit & { duplex?: "half" };

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

export function trafficPercent(value: string | undefined): number {
	if (value === undefined) {
		return 0;
	}

	const parsed = Number(value.trim());
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return 0;
	}

	if (parsed >= 100) {
		return 100;
	}

	return parsed;
}

export function trafficBucket(key: string): number {
	let hash = 2166136261;
	for (let i = 0; i < key.length; i++) {
		hash ^= key.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}

	return (hash >>> 0) % 100;
}

export function shouldProxyToWasmer(request: Request, env: WorkerEnv): boolean {
	const percent = trafficPercent(env.WASMER_TRAFFIC_PERCENT);
	if (percent <= 0) {
		return false;
	}

	if (percent >= 100) {
		return true;
	}

	return trafficBucket(clientIp(request)) < percent;
}

export function wasmerOrigin(env: WorkerEnv): URL {
	const raw = env.WASMER_ORIGIN?.trim();
	if (raw) {
		try {
			const url = new URL(raw);
			if (url.protocol === "https:" || url.protocol === "http:") {
				return url;
			}
		} catch {
			// Fall through to the hosted Wasmer app.
		}
	}

	return new URL(DEFAULT_WASMER_ORIGIN);
}

function rewriteWasmerLocation(
	response: Response,
	origin: URL,
	incoming: URL,
): Response {
	const location = response.headers.get("location");
	if (!location) {
		return response;
	}

	let redirected: URL;
	try {
		redirected = new URL(location, origin);
	} catch {
		return response;
	}

	if (redirected.hostname !== origin.hostname) {
		return response;
	}

	redirected.protocol = incoming.protocol;
	redirected.host = incoming.host;
	const headers = new Headers(response.headers);
	headers.set("location", redirected.toString());
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export async function proxyToWasmer(
	request: Request,
	env: WorkerEnv,
	proxyFetch: WorkerProxy,
): Promise<Response> {
	const incoming = new URL(request.url);
	const origin = wasmerOrigin(env);
	const url = new URL(`${incoming.pathname}${incoming.search}`, origin);
	const headers = new Headers(request.headers);
	for (const name of HOP_BY_HOP_HEADERS) {
		headers.delete(name);
	}

	headers.set("x-forwarded-host", incoming.host);
	headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
	headers.delete(EDGE_CLIENT_IP_HEADER);
	headers.delete(EDGE_TOKEN_HEADER);

	const ip = clientIp(request);
	if (ip !== "unknown") {
		headers.set("cf-connecting-ip", ip);
		headers.set(EDGE_CLIENT_IP_HEADER, ip);
	} else {
		headers.delete("cf-connecting-ip");
	}

	if (env.WASMER_EDGE_TOKEN) {
		headers.set(EDGE_TOKEN_HEADER, env.WASMER_EDGE_TOKEN);
	}

	const hasBody = request.method !== "GET" && request.method !== "HEAD";
	const init: OutboundRequestInit = {
		method: request.method,
		headers,
		body: hasBody ? request.body : undefined,
		redirect: "manual",
	};
	if (hasBody && request.body) {
		init.duplex = "half";
	}

	const response = await proxyFetch(new Request(url, init));
	return rewriteWasmerLocation(response, origin, incoming);
}

async function fetchWasmer(request: Request): Promise<Response> {
	return fetch(request);
}

export async function handleWorkerFetch(
	request: Request,
	env: WorkerEnv,
	dispatch: WorkerDispatch = workerRuntime.dispatch,
	proxyFetch: WorkerProxy = fetchWasmer,
): Promise<Response> {
	const limited = await applyRateLimit(request, env);
	if (limited) {
		return limited;
	}

	if (shouldProxyToWasmer(request, env)) {
		return proxyToWasmer(request, env, proxyFetch);
	}

	bindPublicAssets(env.ASSETS);
	return dispatch(WORKER_PORT, request);
}
