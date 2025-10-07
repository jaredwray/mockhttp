import type { FastifyRequest } from "fastify";

/**
 * Configuration for the injected response
 */
export type InjectionResponse = {
	/**
	 * The response body (can be string, object, or buffer)
	 */
	response: string | Record<string, unknown> | Buffer;
	/**
	 * HTTP status code for the response
	 * @default 200
	 */
	statusCode?: number;
	/**
	 * Response headers
	 */
	headers?: Record<string, string | string[]>;
};

/**
 * Criteria for matching requests to inject responses
 */
export type InjectionMatcher = {
	/**
	 * URL path to match (supports wildcards with *)
	 * @example "/api/users" - exact match
	 * @example "/api/*" - wildcard match
	 */
	url?: string;
	/**
	 * Hostname to match
	 * @example "localhost"
	 * @example "api.example.com"
	 */
	hostname?: string;
	/**
	 * HTTP method to match
	 * @example "GET"
	 * @example "POST"
	 */
	method?: string;
	/**
	 * Request headers to match (all specified headers must match)
	 */
	headers?: Record<string, string>;
};

/**
 * A tap represents an active injection that can be removed later
 */
export type InjectionTap = {
	/**
	 * Unique identifier for this injection
	 */
	id: string;
	/**
	 * The response configuration
	 */
	response: InjectionResponse;
	/**
	 * The request matcher configuration
	 */
	matcher?: InjectionMatcher;
};

/**
 * Manages HTTP response injections for testing and mocking
 */
export class TapManager {
	private _injections: Map<string, InjectionTap>;
	private _idCounter: number;

	constructor() {
		this._injections = new Map();
		this._idCounter = 0;
	}

	/**
	 * Get all active injection taps
	 */
	public get injections(): Map<string, InjectionTap> {
		return this._injections;
	}

	/**
	 * Check if there are any active injections
	 */
	public get hasInjections(): boolean {
		return this._injections.size > 0;
	}

	/**
	 * Inject a custom response for requests matching the given criteria
	 * @param response - The response configuration
	 * @param matcher - Optional criteria to match requests
	 * @returns A tap object that can be used to remove the injection
	 */
	public inject(
		response: InjectionResponse,
		matcher?: InjectionMatcher,
	): InjectionTap {
		this._idCounter++;
		const id = `tap-${this._idCounter}`;

		const tap: InjectionTap = {
			id,
			response,
			matcher,
		};

		this._injections.set(id, tap);

		return tap;
	}

	/**
	 * Remove an injection by its tap object or ID
	 * @param tapOrId - The tap object or tap ID to remove
	 * @returns true if the injection was removed, false if it wasn't found
	 */
	public removeInjection(tapOrId: InjectionTap | string): boolean {
		const id = typeof tapOrId === "string" ? tapOrId : tapOrId.id;
		return this._injections.delete(id);
	}

	/**
	 * Find the first injection that matches the given request
	 * @param request - The Fastify request object
	 * @returns The matching injection tap, or undefined if no match
	 */
	public matchRequest(request: FastifyRequest): InjectionTap | undefined {
		for (const tap of this._injections.values()) {
			if (this.requestMatches(request, tap.matcher)) {
				return tap;
			}
		}
		return undefined;
	}

	/**
	 * Clear all injections
	 */
	public clear(): void {
		this._injections.clear();
	}

	/**
	 * Check if a request matches the given matcher criteria
	 * @param request - The Fastify request object
	 * @param matcher - The matcher criteria (undefined matches all requests)
	 * @returns true if the request matches
	 */
	private requestMatches(
		request: FastifyRequest,
		matcher?: InjectionMatcher,
	): boolean {
		// If no matcher is provided, match all requests
		if (!matcher) {
			return true;
		}

		// Match URL pattern
		if (matcher.url) {
			if (!this.urlMatches(request.url, matcher.url)) {
				return false;
			}
		}

		// Match hostname
		if (matcher.hostname) {
			if (request.hostname !== matcher.hostname) {
				return false;
			}
		}

		// Match HTTP method
		if (matcher.method) {
			if (request.method.toUpperCase() !== matcher.method.toUpperCase()) {
				return false;
			}
		}

		// Match headers (all specified headers must match)
		if (matcher.headers) {
			for (const [key, value] of Object.entries(matcher.headers)) {
				const requestHeader = request.headers[key.toLowerCase()];
				if (requestHeader !== value) {
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * Check if a URL matches a pattern (supports wildcards with *)
	 * @param url - The URL to test
	 * @param pattern - The pattern to match against
	 * @returns true if the URL matches the pattern
	 */
	private urlMatches(url: string, pattern: string): boolean {
		// Remove query string from URL for matching
		const urlPath = url.split("?")[0];

		// Exact match
		if (pattern === urlPath) {
			return true;
		}

		// Wildcard match
		if (pattern.includes("*")) {
			const regexPattern = pattern
				.split("*")
				.map((part) => part.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"))
				.join(".*");
			const regex = new RegExp(`^${regexPattern}$`);
			return regex.test(urlPath);
		}

		return false;
	}
}
