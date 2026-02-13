import process from "node:process";
import { MockHttp } from "./mock-http.js";

// Start the Fastify server
export const start = async () => {
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

	await mockHttp.start();

	return mockHttp;
};

// Only start the server if this is the main module (not imported)
/* v8 ignore next -- @preserve */
if (import.meta.url === `file://${process.argv[1]}`) {
	await start();
}

export { MockHttp as default, MockHttp as mockhttp } from "./mock-http.js";
export type { HttpsOptions } from "./mock-http.js";
export {
	generateCertificate,
	generateCertificateFiles,
} from "./certificate.js";
export type {
	CertificateOptions,
	CertificateResult,
	CertificateFileOptions,
} from "./certificate.js";
export type {
	InjectionMatcher,
	InjectionResponse,
	InjectionTap,
} from "./tap-manager.js";
