/**
 * A request captured by a bin, including method, headers, body and metadata.
 */
export type CapturedRequest = {
	/** Unique identifier for this captured request */
	id: string;
	/** Identifier of the bin that captured this request */
	binId: string;
	/** HTTP method (GET, POST, etc.) */
	method: string;
	/** Request URL path + query, relative to the bin (e.g. "/foo?x=1") */
	url: string;
	/** Sub-path after the bin id ("/" if the request hit the bin root) */
	path: string;
	/** Parsed query string parameters */
	query: Record<string, string | string[]>;
	/** Request headers */
	headers: Record<string, string | string[]>;
	/** Client IP address as reported by Fastify */
	remoteAddress: string;
	/** Content-Type header value, if any */
	contentType?: string;
	/** Original body length in bytes */
	bodySize: number;
	/** Body payload as utf8 text, base64-encoded bytes, or null when empty */
	body: string | null;
	/** Encoding used for the `body` field */
	bodyEncoding: "utf8" | "base64" | "none";
	/** True if the body was longer than the configured `maxBodySize` */
	truncated: boolean;
	/** ISO timestamp of when the request was captured */
	capturedAt: string;
};

/**
 * Metadata for a bin (without its captured requests).
 */
export type Bin = {
	/** Unique short identifier for the bin */
	id: string;
	/** ISO timestamp of bin creation */
	createdAt: string;
	/** ISO timestamp at which the bin expires */
	expiresAt: string;
	/** Number of requests currently stored in the bin */
	requestCount: number;
};
