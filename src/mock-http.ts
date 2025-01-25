import {Hookified, type HookifiedOptions} from 'hookified';
import {fastify, type FastifyInstance} from 'fastify';

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
	httpBin?: HttpBinOptions | boolean;
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
	private _httpBin: boolean | HttpBinOptions = true;
	private readonly _server = fastify();

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

	public get httpBin(): boolean | HttpBinOptions {
		return this._httpBin;
	}

	public set httpBin(httpBinary: boolean | HttpBinOptions) {
		this._httpBin = httpBinary;
	}

	public get server(): FastifyInstance {
		return this._server;
	}
}

export const mockhttp = MockHttp;
