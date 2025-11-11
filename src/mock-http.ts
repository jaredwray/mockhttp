import path from "node:path";
import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import { fastifySwagger } from "@fastify/swagger";
import { detect } from "detect-port";
import Fastify, { type FastifyInstance } from "fastify";
import { Hookified, type HookifiedOptions } from "hookified";
import { fastifyConfig } from "./fastify-config.js";
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
	deleteRoute,
	getRoute,
	patchRoute,
	postRoute,
	putRoute,
} from "./routes/http-methods/index.js";
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
	 * Hookified options.
	 */
	hookOptions?: HookifiedOptions;
};

export class MockHttp extends Hookified {
	private _port = 3000;
	private _host = "0.0.0.0";
	private _autoDetectPort = true;
	private _helmet = true;
	private _apiDocs = true;
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
	};

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
		try {
			/* v8 ignore next -- @preserve */
			if (this._server) {
				await this._server.close();
			}

			this._server = Fastify(fastifyConfig);

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
				await this._server.register(fastifyHelmet);
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
}

export const mockhttp = MockHttp;
