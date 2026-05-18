import { randomUUID } from "node:crypto";
import {
	type Bin,
	type BinStore,
	type CapturedRequest,
	InMemoryBinStore,
} from "./bin-store.js";

/**
 * Configuration options for {@link BinManager}.
 */
export type BinManagerOptions = {
	/** Storage backend. Defaults to a new {@link InMemoryBinStore}. */
	store?: BinStore;
	/** Bin lifetime in milliseconds. Defaults to 24 hours. */
	defaultTtlMs?: number;
	/** Maximum number of requests retained per bin (FIFO). Defaults to 100. */
	maxRequestsPerBin?: number;
	/** Maximum captured body size in bytes. Larger bodies are truncated. Defaults to 1 MiB. */
	maxBodySize?: number;
	/** Length of generated bin and request ids. Defaults to 12. */
	idLength?: number;
	/** Interval between cleanup sweeps in milliseconds. Defaults to 1 minute. */
	cleanupIntervalMs?: number;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_MAX_BODY_SIZE = 1024 * 1024;
const DEFAULT_ID_LENGTH = 12;
const DEFAULT_CLEANUP_INTERVAL_MS = 60_000;

/**
 * Manages request bins: ephemeral URL endpoints that capture incoming HTTP
 * requests so they can be inspected later.
 */
export class BinManager {
	private readonly _store: BinStore;
	private readonly _defaultTtlMs: number;
	private readonly _maxRequestsPerBin: number;
	private readonly _maxBodySize: number;
	private readonly _idLength: number;
	private readonly _cleanupIntervalMs: number;
	private _cleanupTimer: ReturnType<typeof setInterval> | undefined;

	constructor(options?: BinManagerOptions) {
		this._store = options?.store ?? new InMemoryBinStore();
		this._defaultTtlMs = options?.defaultTtlMs ?? DEFAULT_TTL_MS;
		this._maxRequestsPerBin =
			options?.maxRequestsPerBin ?? DEFAULT_MAX_REQUESTS;
		this._maxBodySize = options?.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;
		this._idLength = options?.idLength ?? DEFAULT_ID_LENGTH;
		this._cleanupIntervalMs =
			options?.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
	}

	/** Underlying storage backend. */
	public get store(): BinStore {
		return this._store;
	}

	/** Maximum captured body size in bytes. */
	public get maxBodySize(): number {
		return this._maxBodySize;
	}

	/** Maximum number of requests retained per bin. */
	public get maxRequestsPerBin(): number {
		return this._maxRequestsPerBin;
	}

	/** Default bin lifetime in milliseconds. */
	public get defaultTtlMs(): number {
		return this._defaultTtlMs;
	}

	/** Create a new bin with the configured TTL. */
	public createBin(): Bin {
		const id = this.generateId();
		const now = Date.now();
		const bin: Bin = {
			id,
			createdAt: new Date(now).toISOString(),
			expiresAt: new Date(now + this._defaultTtlMs).toISOString(),
			requestCount: 0,
		};
		this._store.createBin(bin);
		return bin;
	}

	/**
	 * Look up a bin by id. Returns `undefined` if the bin does not exist or
	 * has expired (in which case it is also lazily removed).
	 */
	public getBin(id: string): Bin | undefined {
		const bin = this._store.getBin(id);
		if (!bin) {
			return undefined;
		}
		if (Date.parse(bin.expiresAt) <= Date.now()) {
			this._store.deleteBin(id);
			return undefined;
		}
		return bin;
	}

	/** List all non-expired bins. */
	public listBins(): Bin[] {
		const now = Date.now();
		const result: Bin[] = [];
		for (const bin of this._store.listBins()) {
			if (Date.parse(bin.expiresAt) <= now) {
				this._store.deleteBin(bin.id);
				continue;
			}
			result.push(bin);
		}
		return result;
	}

	/** Delete a bin. Returns true if the bin existed. */
	public deleteBin(id: string): boolean {
		return this._store.deleteBin(id);
	}

	/**
	 * Record an incoming request against a bin. Returns the stored
	 * {@link CapturedRequest}, or `undefined` if the bin does not exist or is
	 * expired.
	 */
	public recordRequest(
		binId: string,
		raw: Omit<CapturedRequest, "id" | "binId" | "capturedAt">,
	): CapturedRequest | undefined {
		const bin = this.getBin(binId);
		if (!bin) {
			return undefined;
		}
		const captured: CapturedRequest = {
			...raw,
			id: this.generateId(),
			binId,
			capturedAt: new Date().toISOString(),
		};
		this._store.addRequest(binId, captured, this._maxRequestsPerBin);
		return captured;
	}

	/** List captured requests for a bin (newest first). */
	public getRequests(binId: string): CapturedRequest[] {
		return this._store.getRequests(binId);
	}

	/** Look up a single captured request. */
	public getRequest(binId: string, reqId: string): CapturedRequest | undefined {
		return this._store.getRequest(binId, reqId);
	}

	/** Clear all captured requests in a bin. */
	public clearRequests(binId: string): void {
		this._store.clearRequests(binId);
	}

	/** Start the periodic cleanup of expired bins. */
	public start(): void {
		if (this._cleanupTimer) {
			return;
		}
		this._cleanupTimer = setInterval(() => {
			this._store.cleanupExpired(Date.now());
		}, this._cleanupIntervalMs);
		this._cleanupTimer.unref();
	}

	/** Stop the periodic cleanup. Idempotent. */
	public stop(): void {
		if (this._cleanupTimer) {
			clearInterval(this._cleanupTimer);
			this._cleanupTimer = undefined;
		}
	}

	private generateId(): string {
		return randomUUID().replaceAll("-", "").slice(0, this._idLength);
	}
}
