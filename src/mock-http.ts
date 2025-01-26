import path from 'node:path';
import fastifyStatic from '@fastify/static';
import fastifyHelmet from '@fastify/helmet';
import {fastifySwagger} from '@fastify/swagger';
import {Hookified, type HookifiedOptions} from 'hookified';
import Fastify, {type FastifyInstance} from 'fastify';
import {fastifySwaggerConfig, registerSwaggerUi} from './swagger.js';
import {fastifyConfig} from './fastify-config.js';
import {indexRoute} from './routes/index.js';
import {sitemapRoute} from './routes/sitemap.js';
import {
	getRoute, postRoute, deleteRoute, putRoute, patchRoute,
} from './routes/http-methods/index.js';
import {statusCodeRoute} from './routes/status-codes/index.js';
import {ipRoute, headersRoute, userAgentRoute} from './routes/request-inspection/index.js';
import {cacheRoutes, etagRoutes, responseHeadersRoutes} from './routes/response-inspection/index.js';
import {absoluteRedirectRoute, relativeRedirectRoute, redirectToRoute} from './routes/redirects/index.js';

// eslint-disable-next-line unicorn/prevent-abbreviations
export type HttpBinOptions = {
	httpMethods?: boolean;
	redirects?: boolean;
	requestInspection?: boolean;
	responseInspection?: boolean;
	statusCodes?: boolean;
};

export type MockHttpOptions = {
	/**
	 * The port to listen on. If not provided, defaults to 3000 and falls back to 3001 if the PORT is in use.
	 */
	port?: number;
	/**
	 * The host to listen on. If not provided, defaults to '0.0.0.0'.
	 */
	host?: string;
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
	private _host = '0.0.0.0';
	private _helmet = true;
	private _apiDocs = true;
	private _httpBin: HttpBinOptions = {
		httpMethods: true,
		redirects: true,
		requestInspection: true,
		responseInspection: true,
		statusCodes: true,
	};

	// eslint-disable-next-line new-cap
	private _server: FastifyInstance = Fastify();

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

	public get port(): number {
		return this._port;
	}

	public set port(port: number) {
		this._port = port;
	}

	public get host(): string {
		return this._host;
	}

	public set host(host: string) {
		this._host = host;
	}

	public get helmet(): boolean {
		return this._helmet;
	}

	public set helmet(helmet: boolean) {
		this._helmet = helmet;
	}

	public get apiDocs(): boolean {
		return this._apiDocs;
	}

	// eslint-disable-next-line unicorn/prevent-abbreviations
	public set apiDocs(apiDocs: boolean) {
		this._apiDocs = apiDocs;
	}

	public get httpBin(): HttpBinOptions {
		return this._httpBin;
	}

	public set httpBin(httpBinary: HttpBinOptions) {
		this._httpBin = httpBinary;
	}

	public get server(): FastifyInstance {
		return this._server;
	}

	public set server(server: FastifyInstance) {
		this._server = server;
	}

	public async start(): Promise<void> {
		try {
			const {port, host} = this;

			if (this._server) {
				await this._server.close();
			}

			// eslint-disable-next-line new-cap
			this._server = Fastify(fastifyConfig);

			// Register Scalar API client
			await this._server.register(fastifyStatic, {
				root: path.resolve('./node_modules/@scalar/api-reference/dist'),
				prefix: '/scalar',
			});

			// Register the Public for favicon
			await this.server.register(fastifyStatic, {
				root: path.resolve('./public'),
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

			const {httpMethods, redirects, requestInspection, responseInspection, statusCodes} = this._httpBin;

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

			if (redirects) {
				await this.registerRedirectRoutes();
			}

			await this._server.listen({port, host});
		} catch (error) {
			/* c8 ignore next 2 */
			this._server.log.error(error);
		}
	}

	public async close(): Promise<void> {
		await this._server.close();
	}

	public async registerApiDocs(fastifyInstance?: FastifyInstance): Promise<void> {
		const fastify = fastifyInstance ?? this._server;

		// Set up Swagger for API documentation
		await fastify.register(fastifySwagger, fastifySwaggerConfig);

		// Register Swagger UI
		await registerSwaggerUi(fastify);

		// Register the index / home page route
		await fastify.register(indexRoute);
	}

	public async registerHttpMethods(fastifyInstance?: FastifyInstance): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(getRoute);
		await fastify.register(postRoute);
		await fastify.register(deleteRoute);
		await fastify.register(putRoute);
		await fastify.register(patchRoute);
	}

	public async registerStatusCodeRoutes(fastifyInstance?: FastifyInstance): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(statusCodeRoute);
	}

	public async registerRequestInspectionRoutes(fastifyInstance?: FastifyInstance): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(ipRoute);
		await fastify.register(headersRoute);
		await fastify.register(userAgentRoute);
	}

	public async registerResponseInspectionRoutes(fastifyInstance?: FastifyInstance): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(cacheRoutes);
		await fastify.register(etagRoutes);
		await fastify.register(responseHeadersRoutes);
	}

	public async registerRedirectRoutes(fastifyInstance?: FastifyInstance): Promise<void> {
		const fastify = fastifyInstance ?? this._server;
		await fastify.register(absoluteRedirectRoute);
		await fastify.register(relativeRedirectRoute);
		await fastify.register(redirectToRoute);
	}
}

export const mockhttp = MockHttp;
