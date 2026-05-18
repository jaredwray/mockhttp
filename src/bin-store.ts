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

/**
 * Storage backend for bins and their captured requests. The default
 * implementation is in-memory; alternative backends (Redis, SQLite, etc.) can
 * implement this interface without changes to the rest of the codebase.
 */
export interface BinStore {
	/** Create a new bin record. */
	createBin(bin: Bin): void;
	/** Look up a bin by id. */
	getBin(id: string): Bin | undefined;
	/** Return all bins. */
	listBins(): Bin[];
	/** Remove a bin and all its captured requests. Returns true if removed. */
	deleteBin(id: string): boolean;
	/**
	 * Append a captured request to a bin, dropping the oldest if the bin has
	 * already reached `max` requests (FIFO).
	 */
	addRequest(binId: string, req: CapturedRequest, max: number): void;
	/** List captured requests for a bin (newest first). */
	getRequests(binId: string): CapturedRequest[];
	/** Look up a single captured request by id. */
	getRequest(binId: string, reqId: string): CapturedRequest | undefined;
	/** Clear all captured requests in a bin (the bin itself is preserved). */
	clearRequests(binId: string): void;
	/**
	 * Remove bins whose `expiresAt` is in the past relative to `now`.
	 * Returns the ids of bins that were removed.
	 */
	cleanupExpired(now: number): string[];
}

/**
 * In-memory implementation of {@link BinStore} backed by two Maps. State is
 * lost when the process exits.
 */
export class InMemoryBinStore implements BinStore {
	private readonly _bins = new Map<string, Bin>();
	private readonly _requests = new Map<string, CapturedRequest[]>();

	public createBin(bin: Bin): void {
		this._bins.set(bin.id, bin);
		this._requests.set(bin.id, []);
	}

	public getBin(id: string): Bin | undefined {
		return this._bins.get(id);
	}

	public listBins(): Bin[] {
		return [...this._bins.values()];
	}

	public deleteBin(id: string): boolean {
		this._requests.delete(id);
		return this._bins.delete(id);
	}

	public addRequest(binId: string, req: CapturedRequest, max: number): void {
		const bin = this._bins.get(binId);
		const list = this._requests.get(binId);
		if (!bin || !list) {
			return;
		}

		list.unshift(req);
		while (list.length > max) {
			list.pop();
		}
		bin.requestCount = list.length;
	}

	public getRequests(binId: string): CapturedRequest[] {
		return [...(this._requests.get(binId) ?? [])];
	}

	public getRequest(binId: string, reqId: string): CapturedRequest | undefined {
		return this._requests.get(binId)?.find((r) => r.id === reqId);
	}

	public clearRequests(binId: string): void {
		const bin = this._bins.get(binId);
		if (!bin) {
			return;
		}
		this._requests.set(binId, []);
		bin.requestCount = 0;
	}

	public cleanupExpired(now: number): string[] {
		const removed: string[] = [];
		for (const [id, bin] of this._bins) {
			if (Date.parse(bin.expiresAt) <= now) {
				this._bins.delete(id);
				this._requests.delete(id);
				removed.push(id);
			}
		}
		return removed;
	}
}
