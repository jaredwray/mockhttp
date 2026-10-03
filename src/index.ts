import * as fsPromises from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { MockHttp } from "./mock-http.js";

// `@vercel/nft` keeps directories referenced by `path.join(process.cwd(), ...)`.
// Serving still uses the package-root paths inside MockHttp.
const wasmerAssetDirectories = [
	path.join(process.cwd(), "public"),
	path.join(process.cwd(), "site/dist"),
];

async function includeWasmerAssetDirectories(): Promise<void> {
	await Promise.all(
		wasmerAssetDirectories.map((directory) =>
			fsPromises.access(directory).catch(() => undefined),
		),
	);
}

// Start the Fastify server
export const start = async () => {
	await includeWasmerAssetDirectories();

	const mockHttp = new MockHttp();

	/* v8 ignore next -- @preserve */
	if (process.env.PORT) {
		mockHttp.port = Number.parseInt(process.env.PORT, 10);
	}

	/* v8 ignore next -- @preserve */
	if (process.env.HOST) {
		mockHttp.host = process.env.HOST;
	}

	/* v8 ignore next -- @preserve */
	if (process.env.LOGGING === "false") {
		mockHttp.logging = false;
	}

	/* v8 ignore next -- @preserve */
	if (process.env.HTTP2 === "true") {
		mockHttp.http2 = true;
	}

	if (process.env.AUTO_DETECT_PORT === "false") {
		mockHttp.autoDetectPort = false;
	}

	await mockHttp.start();

	return mockHttp;
};

// Only start the server if this is the main module (not imported)
/* v8 ignore next -- @preserve */
if (import.meta.url === `file://${process.argv[1]}`) {
	await start();
}

export type { BinManagerOptions } from "./bin-manager.js";
export { BinManager } from "./bin-manager.js";
export type {
	Bin,
	BinStore,
	CapturedRequest,
} from "./bin-store.js";
export { InMemoryBinStore } from "./bin-store.js";
export type {
	CertificateFileOptions,
	CertificateOptions,
	CertificateResult,
} from "./certificate.js";
export {
	generateCertificate,
	generateCertificateFiles,
} from "./certificate.js";
export type { HttpsOptions } from "./mock-http.js";
export { MockHttp as default, MockHttp as mockhttp } from "./mock-http.js";
export type {
	InjectionMatcher,
	InjectionResponse,
	InjectionTap,
} from "./tap-manager.js";
