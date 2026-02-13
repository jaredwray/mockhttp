import * as fsPromises from "node:fs/promises";
import path from "node:path";
import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit, {
	type RateLimitPluginOptions,
} from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { fastifySwagger } from "@fastify/swagger";
import { detect } from "detect-port";
import Fastify, { type FastifyInstance } from "fastify";
import { Hookified, type HookifiedOptions } from "hookified";
import { type CertificateOptions, generateCertificate } from "./certificate.js";
import { getFastifyConfig } from "./fastify-config.js";
import { anythingRoute } from "./routes/anything/index.js";
import {
	basicAuthRoute,
	bearerAuthRoute,
	digestAuthRoute,
	hiddenBasicAuthRoute,
} from "./routes/auth/index.js";
import {
	deleteCookieRoute,
	getCookiesRoute,
	postCookieRoute,
} from "./routes/cookies/index.js";
import {
	base64Route,
	bytesRoute,
	delayRoute,
	dripRoute,
	linksRoute,
	rangeRoute,
	streamBytesRoute,
	streamRoute,
	uuidRoute,
} from "./routes/dynamic-data/index.js";
import {
	deleteRoute,
	getRoute,
	patchRoute,
	postRoute,
	putRoute,
} from "./routes/http-methods/index.js";
import { imageRoutes } from "./routes/images/index.js";
import { indexRoute } from "./routes/index.js";
import {
	absoluteRedirectRoute,
	redirectToRoute,
	relativeRedirectRoute,
} from "./routes/redirects/index.js";
import {
	headersRoute,
	ipRoute,
	userAgentRoute,
} from "./routes/request-inspection/index.js";
import { responseFormatRoutes } from "./routes/response-formats/index.js";
import {
	cacheRoutes,
	etagRoutes,
	responseHeadersRoutes,
} from "./routes/response-inspection/index.js";
import { sitemapRoute } from "./routes/sitemap.js";
import { statusCodeRoute } from "./routes/status-codes/index.js";
import { fastifySwaggerConfig, registerSwaggerUi } from "./swagger.js";
import { TapManager } from "./tap-manager.js";

export type HttpBinOptions = {
	httpMethods?: boolean;
	redirects?: boolean;
	requestInspection?: boolean;
	responseInspection?: boolean;
	statusCodes?: boolean;
	responseFormats?: boolean;
	cookies?: boolean;
	anything?: boolean;
	auth?: boolean;
	images?: boolean;
	dynamicData?: boolean;
};

export type HttpsOptions = {
	/**
	 * PEM-encoded certificate string, or file path to a certificate PEM file.
	 */
	cert?: string;
	/**
	 * PEM-encoded private key string, or file path to a private key PEM file.
	 */
	key?: string;
	/**
	 * If true, auto-generate a self-signed certificate. Defaults to true when no cert/key provided.
	 */
	autoGenerate?: boolean;
	/**
	 * Options for auto-generating a self-signed certificate. Only used when auto-generating.
	 */
	certificateOptions?: CertificateOptions;
};

export type MockHttpOptions = {
	/**
	 * The port to listen on. If not provided, defaults to 3000 and detects the next available port if in use.
	 */
	port?: number;
	/**
	 * The host to listen on. If not provided, defaults to '0.0.0.0'.
	 */
	host?: string;
	/**
	 * Whether to automatically detect the next available port if the provided port is in use. Defaults
	 * to true.
	 */
	autoDetectPort?: boolean;
	/**
	 * Whether to use Helmet for security headers. Defaults to true.
	 */
	helmet?: boolean;
	/**
	 * Whether to use Swagger for API documentation. Defaults to true.
	 */
	apiDocs?: boolean;
	/**
	 * Whether to use Swagger UI. Defaults to true.
	 */
	httpBin?: HttpBinOptions;
	/**
	 * Rate limiting options. Defaults to 1000 requests per minute (localhost excluded).
	 * Set to undefined to disable rate limiting, or provide custom options to configure.
	 */
	rateLimit?: boolean | RateLimitPluginOptions;
	/**
	 * Hookified options.
	 */
	hookOptions?: HookifiedOptions;
	/**
	 * Whether to enable logging. Defaults to true.
	 */
	logging?: boolean;
	/**
	 * HTTPS configuration. Set to true to auto-generate a self-signed certificate,
	 * or provide an object with cert/key strings/paths or auto-generation options.
	 */
	https?: boolean | HttpsOptions;
};

export class MockHttp extends Hookified {
	private _port = 3000;
	private _host = "0.0.0.0";
	private _autoDetectPort = true;
	private _helmet = true;
	private _apiDocs = true;
	private _logging = true;
	private _httpBin: HttpBinOptions = {
		httpMethods: true,
		redirects: true,
		requestInspection: true,
		responseInspection: true,
		responseFormats: true,
		statusCodes: true,
		cookies: true,
		anything: true,
		auth: true,
		images: true,
		dynamicData: true,
	};

	private _rateLimit?: RateLimitPluginOptions = {
		max: 1000,
		timeWindow: "1 minute",
		allowList: ["127.0.0.1", "::1"],
	};

	private _https: HttpsOptions | undefined;
	private _httpsCredentials: { cert: string; key: string } | undefined;

	private _server: FastifyInstance = Fastify();
	private _taps: TapManager = new TapManager();

	constructor(options?: MockHttpOptions) {
		super(options?.hookOptions);

		if (options?.port) {
			this._port = options.port;
		}

		if (options?.host) {
			this._host = options.host;
		}

		if (options?.helmet !== undefined) {
			this._helmet = options.helmet;
		}

		if (options?.apiDocs !== undefined) {
			this._apiDocs = options.apiDocs;
		}

		if (options?.httpBin !== undefined) {
			this._httpBin = options.httpBin;
		}

		if (options?.rateLimit !== undefined) {
			if (options.rateLimit === false) {
				this._rateLimit = undefined;
			} else {
				this._rateLimit = options.rateLimit as RateLimitPluginOptions;
			}
		}

		if (options?.logging !== undefined) {
			this._logging = options.logging;
		}

		if (options?.https !== undefined) {
			if (options.https === true) {
				this._https = { autoGenerate: true };
			} else if (options.https === false) {
				this._https = undefined;
			} else {
				this._https = options.https;
			}
		}
	}

	/**
	 * The port to listen on. If not provided, defaults to 3000 and detects the next available port if in use.
	 * @default 3000
	 */
	public get port(): number {
		return this._port;
	}

	/**
	 * The port to listen on. If not provided, defaults to 3000 and detects the next available port if in use.
	 * @default 3000
	 */
	public set port(port: number) {
		this._port = port;
	}

	/**
	 * The host to listen on. If not provided, defaults to 'localhost'.
	 * @default 'localhost'
	 */
	public get host(): string {
		return this._host;
	}

	/**
	 * The host to listen on. If not provided, defaults to 'localhost'.
	 * @default 'localhost'
	 */
	public set host(host: string) {
		this._host = host;
	}

	/**
	 * Whether to automatically detect the next available port if the provided port is in use. Defaults to true.
	 * @default true
	 */
	public get autoDetectPort(): boolean {
		return this._autoDetectPort;
	}

	/**
	 * Whether to automatically detect the next available port if the provided port is in use. Defaults to true.
	 * @default true
	 */
	public set autoDetectPort(autoDetectPort: boolean) {
		this._autoDetectPort = autoDetectPort;
	}

	/**
	 * Whether to use Helmet for security headers. Defaults to true.
	 * @default true
	 */
	public get helmet(): boolean {
		return this._helmet;
	}

	/**
	 * Whether to use Helmet for security headers. Defaults to true.
	 * @default true
	 */
	public set helmet(helmet: boolean) {
		this._helmet = helmet;
	}

	/**
	 * Whether to use Swagger for API documentation. Defaults to true.
	 * @default true
	 */

	public get apiDocs(): boolean {
		return this._apiDocs;
	}

	/**
	 * Whether to use Swagger for API documentation. Defaults to true.
	 * @default true
	 */

	public set apiDocs(apiDocs: boolean) {
		this._apiDocs = apiDocs;
	}

	/**
	 * Whether to enable logging. Defaults to true.
	 * @default true
	 */
	public get logging(): boolean {
		return this._logging;
	}

	/**
	 * Whether to enable logging. Defaults to true.
	 * @default true
	 */
	public set logging(logging: boolean) {
		this._logging = logging;
	}

	/**
	 * HTTPS configuration. Set to true to auto-generate a self-signed certificate,
	 * or provide an HttpsOptions object with cert/key or auto-generation options.
	 */
	public get https(): HttpsOptions | undefined {
		return this._https;
	}

	/**
	 * HTTPS configuration. Set to true to auto-generate a self-signed certificate,
	 * or provide an HttpsOptions object with cert/key or auto-generation options.
	 */
	public set https(value: boolean | HttpsOptions | undefined) {
		if (value === true) {
			this._https = { autoGenerate: true };
		} else if (value === false || value === undefined) {
			this._https = undefined;
		} else {
			this._https = value;
		}
	}

	/**
	 * Whether the server is running in HTTPS mode.
	 */
	public get isHttps(): boolean {
		return this._httpsCredentials !== undefined;
	}

	/**
	 * HTTP Bin options. Defaults to all enabled.
	 */
	public get httpBin(): HttpBinOptions {
		return this._httpBin;
	}

	/**
	 * HTTP Bin options. Defaults to all enabled.
	 */
	public set httpBin(httpBinary: HttpBinOptions) {
		this._httpBin = httpBinary;
	}

	/**
	 * Rate limiting options. Defaults to 1000 requests per minute (localhost excluded).
	 * Set to undefined to disable rate limiting, or provide custom options to configure.
	 * @default { max: 1000, timeWindow: "1 minute", allowList: ["127.0.0.1", "::1"] }
	 */
	public get rateLimit(): RateLimitPluginOptions | undefined {
		return this._rateLimit;
	}

	/**
	 * Rate limiting options. Defaults to 1000 requests per minute (localhost excluded).
	 * Set to undefined to disable rate limiting, or provide custom options to configure.
	 *
	 * Note: Changing this property requires restarting the server (close() then start()) for changes to take effect.
	 * @default { max: 1000, timeWindow: "1 minute", allowList: ["127.0.0.1", "::1"] }
	 */
	public set rateLimit(rateLimit: RateLimitPluginOptions | undefined) {
		this._rateLimit = rateLimit;
	}

	/**
	 * The Fastify server instance.
	 */
	public get server(): FastifyInstance {
		return this._server;
	}

	/**
	 * The Fastify server instance.
	 */
	public set server(server: FastifyInstance) {
		this._server = server;
	}

	/**
	 * The TapManager instance for managing injection taps.
	 */
	public get taps(): TapManager {
		return this._taps;
	}

	/**
	 * The TapManager instance for managing injection taps.
	 */
	public set taps(taps: TapManager) {
		this._taps = taps;
	}

	/**
	 * Start the Fastify server. If the server is already running, it will be closed and restarted.
	 */
	public async start(): Promise<void> {
		// Resolve HTTPS credentials before try/catch so config errors propagate
		this._httpsCredentials = undefined;
		if (this._https) {
			this._httpsCredentials = await this.resolveHttpsCredentials(this._https);
		}

		try {
			/* v8 ignore next -- @preserve */
			if (this._server) {
				await this._server.close();
			}

			// Create Fastify instance with or without HTTPS
			if (this._httpsCredentials) {
				this._server = Fastify({
					...getFastifyConfig(this._logging),
					https: {
						key: this._httpsCredentials.key,
						cert: this._httpsCredentials.cert,
					},
				} as Record<string, unknown>) as unknown as FastifyInstance;
			} else {
				this._server = Fastify(getFastifyConfig(this._logging));
			}

			// Register injection hook to intercept requests
			this._server.addHook("onRequest", async (request, reply) => {
				const matchedTap = this._taps.matchRequest(request);
				if (matchedTap) {
					// Handle both static response objects and response functions
					const injectionResponse =
						typeof matchedTap.response === "function"
							? matchedTap.response(request)
							: matchedTap.response;

					const { response, statusCode = 200, headers } = injectionResponse;

					// Set status code
					reply.code(statusCode);

					// Set headers if provided
					if (headers) {
						for (const [key, value] of Object.entries(headers)) {
							reply.header(key, value);
						}
					}

					// Send the response and prevent further processing
					return reply.send(response);
				}
			});

			// Register Scalar API client
			await this._server.register(fastifyStatic, {
				root: path.resolve("./node_modules/@scalar/api-reference/dist"),
				prefix: "/scalar",
			});

			// Register the Public for favicon
			await this.server.register(fastifyStatic, {
				root: path.resolve("./public"),
				decorateReply: false,
			});

			// Register the site map route
			await this._server.register(sitemapRoute);

			// Register the Helmet plugin for security headers
			if (this._helmet) {
				await this._server.register(fastifyHelmet, {
					contentSecurityPolicy: {
						directives: {
							defaultSrc: ["'self'"],
							scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"],
							styleSrc: ["'self'", "'unsafe-inline'"],
							imgSrc: ["'self'", "data:", "https:"],
							fontSrc: ["'self'", "data:"],
							connectSrc: ["'self'"],
							frameSrc: ["'self'"],
							objectSrc: ["'none'"],
							upgradeInsecureRequests: [],
						},
					},
				});
			}

			// Register the rate limit plugin if configured
			if (this._rateLimit) {
				await this._server.register(fastifyRateLimit, this._rateLimit);
			}

			if (this._apiDocs) {
				await this.registerApiDocs();
			}

			const {
				httpMethods,
				redirects,
				requestInspection,
				responseInspection,
				responseFormats,
				statusCodes,
				cookies,
				anything,
				auth,
				images,
				dynamicData,
			} = this._httpBin;

			if (httpMethods) {
				await this.registerHttpMethods();
			}

			if (statusCodes) {
				await this.registerStatusCodeRoutes();
			}

			if (requestInspection) {
				await this.registerRequestInspectionRoutes();
			}

			if (responseInspection) {
				await this.registerResponseInspectionRoutes();
			}

			if (responseFormats) {
				await this.registerResponseFormatRoutes();
			}

			if (redirects) {
				await this.registerRedirectRoutes();
			}

			if (cookies) {
				await this.registerCookieRoutes();
			}

			if (anything) {
				await this.registerAnythingRoutes();
			}

			if (auth) {
				await this.registerAuthRoutes();
			}

			if (images) {
				await this.registerImageRoutes();
			}

			if (dynamicData) {
				await this.registerDynamicDataRoutes();
			}

			if (this._autoDetectPort) {
				const originalPort = this._port;
				this._port = await this.detectPort();

				if (originalPort !== this._port) {
					this._server.log.info(
						`Port ${originalPort} is in use, detected next available port: ${this._port}`,
					);
				}
			}

			await this._server.listen({ port: this._port, host: this._host });
		} catch (error) {
			/* v8 ignore next -- @preserve */
			this._server.log.error(error);
		}
	}

	/**
	 * Close the Fastify server.
	 */
	public async close(): Promise<void> {
		await this._server.close();
	}

	/**
	 * Detect the next available port to run on.
	 * @returns The port that is available to run on
	 */
	public async detectPort(): Promise<number> {
		const { port } = this;
		return detect(port);
	}

	/**
	 * This will register the API documentation routes including openapi and swagger ui.
	 * @param fastifyInstance - the server instance to register the routes on.
	 */
	public async registerApiDocs(
		fastifyInstance?: FastifyInstance,
	): Promise<void> {
		const fastify = fastifyInstance ?? this._server;

		// Set up Swagger for API documentation
		await fastify.register(fastifySwagger, fastifySwaggerConfig);

		// Register Swagger UI
		await registerSwaggerUi(fastify);

		// Register the index / home page route
		await fastify.register(indexRoute);
	}

	/**
	 * Register the HTTP methods routes.
	 * @param fastifyInstance - the server instance to register the routes on.
	 */
	public async registerHttpMethods(
		fastifyInstance?: FastifyInstance,
	): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(getRoute);
		await fastify.register(postRoute);
		await fastify.register(deleteRoute);
		await fastify.register(putRoute);
		await fastify.register(patchRoute);
	}

	/**
	 * Register the status code routes.
	 * @param fastifyInstance - the server instance to register the routes on.
	 */
	public async registerStatusCodeRoutes(
		fastifyInstance?: FastifyInstance,
	): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(statusCodeRoute);
	}

	/**
	 * Register the request inspection routes.
	 * @param fastifyInstance - the server instance to register the routes on.
	 */
	public async registerRequestInspectionRoutes(
		fastifyInstance?: FastifyInstance,
	): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(ipRoute);
		await fastify.register(headersRoute);
		await fastify.register(userAgentRoute);
	}

	/**
	 * Register the response inspection routes.
	 * @param fastifyInstance - the server instance to register the routes on.
	 */
	public async registerResponseInspectionRoutes(
		fastifyInstance?: FastifyInstance,
	): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(cacheRoutes);
		await fastify.register(etagRoutes);
		await fastify.register(responseHeadersRoutes);
	}

	public async registerResponseFormatRoutes(
		fastifyInstance?: FastifyInstance,
	): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(responseFormatRoutes);
	}

	/**
	 * Register the redirect routes.
	 * @param fastifyInstance - the server instance to register the routes on.
	 */
	public async registerRedirectRoutes(
		fastifyInstance?: FastifyInstance,
	): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(absoluteRedirectRoute);
		await fastify.register(relativeRedirectRoute);
		await fastify.register(redirectToRoute);
	}

	/**
	 * Register the cookie routes.
	 * @param fastifyInstance - the server instance to register the routes on.
	 */
	public async registerCookieRoutes(
		fastifyInstance?: FastifyInstance,
	): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(fastifyCookie);
		await fastify.register(getCookiesRoute);
		await fastify.register(postCookieRoute);
		await fastify.register(deleteCookieRoute);
	}

	/**
	 * Register the anything routes.
	 * @param fastifyInstance - the server instance to register the routes on.
	 */
	public async registerAnythingRoutes(
		fastifyInstance?: FastifyInstance,
	): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(anythingRoute);
	}

	/**
	 * Register the auth routes.
	 * @param fastifyInstance - the server instance to register the routes on.
	 */
	public async registerAuthRoutes(
		fastifyInstance?: FastifyInstance,
	): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(basicAuthRoute);
		await fastify.register(hiddenBasicAuthRoute);
		await fastify.register(bearerAuthRoute);
		await fastify.register(digestAuthRoute);
	}

	/**
	 * Register the image routes.
	 * @param fastifyInstance - the server instance to register the routes on.
	 */
	public async registerImageRoutes(
		fastifyInstance?: FastifyInstance,
	): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(imageRoutes);
	}

	/**
	 * Register the dynamic data routes.
	 * @param fastifyInstance - the server instance to register the routes on.
	 */
	public async registerDynamicDataRoutes(
		fastifyInstance?: FastifyInstance,
	): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(uuidRoute);
		await fastify.register(bytesRoute);
		await fastify.register(streamBytesRoute);
		await fastify.register(delayRoute);
		await fastify.register(base64Route);
		await fastify.register(streamRoute);
		await fastify.register(rangeRoute);
		await fastify.register(dripRoute);
		await fastify.register(linksRoute);
	}
	private async resolveHttpsCredentials(
		options: HttpsOptions,
	): Promise<{ cert: string; key: string }> {
		if (options.cert && options.key) {
			const cert = await this.loadPemValue(options.cert);
			const key = await this.loadPemValue(options.key);
			return { cert, key };
		}

		if (options.autoGenerate !== false) {
			const result = generateCertificate(options.certificateOptions);
			return { cert: result.cert, key: result.key };
		}

		throw new Error(
			"HTTPS is enabled but no certificate was provided and autoGenerate is false.",
		);
	}

	private async loadPemValue(value: string): Promise<string> {
		if (value.startsWith("-----")) {
			return value;
		}

		return fsPromises.readFile(value, "utf8");
	}
}

export const mockhttp = MockHttp;
