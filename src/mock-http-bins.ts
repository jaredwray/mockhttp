import { randomUUID } from "node:crypto";
import Keyv from "keyv";
import type { Bin, CapturedRequest } from "./bin-store.js";

/**
 * One bin and its captured requests, stored as a single Keyv value.
 */
type BinDocument = {
	bin: Bin;
	requests: CapturedRequest[];
};

/**
 * Options for a {@link MockHttpBins} instance.
 */
export type MockHttpBinsOptions = {
	/**
	 * Keyv store for bins. The default is `new Keyv()`, which keeps data in memory.
	 * Pass an instance when you want a different Keyv adapter.
	 */
	keyv?: Keyv<BinDocument>;
	/** Bin lifetime in milliseconds. The default is 24 hours. */
	defaultTtlMs?: number;
	/** Maximum number of requests in one bin. The default is 100. */
	maxRequestsPerBin?: number;
	/** Maximum captured body size in bytes. The default is 128 KiB. */
	maxBodySize?: number;
	/** Length of a generated bin id or request id. The default is 12. */
	idLength?: number;
	/** Interval between cleanup sweeps in milliseconds. The default is 1 minute. */
	cleanupIntervalMs?: number;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_MAX_BODY_SIZE = 128 * 1024;
const DEFAULT_ID_LENGTH = 12;
const DEFAULT_CLEANUP_INTERVAL_MS = 60_000;
const BIN_KEY_PREFIX = "bin:";

/**
 * Stores request bins in Keyv.
 * The default store is `new Keyv()`, which keeps data in memory.
 */
export class MockHttpBins {
	private readonly _keyv: Keyv<BinDocument>;
	private readonly _defaultTtlMs: number;
	private readonly _maxRequestsPerBin: number;
	private readonly _maxBodySize: number;
	private readonly _idLength: number;
	private readonly _cleanupIntervalMs: number;
	private readonly _locks = new Map<string, Promise<void>>();
	private _cleanupTimer: ReturnType<typeof setInterval> | undefined;

	constructor(options?: MockHttpBinsOptions) {
		this._keyv = options?.keyv ?? new Keyv<BinDocument>();
		this._defaultTtlMs = options?.defaultTtlMs ?? DEFAULT_TTL_MS;
		// A negative cap would make the eviction loop run without an end.
		this._maxRequestsPerBin = Math.max(
			0,
			options?.maxRequestsPerBin ?? DEFAULT_MAX_REQUESTS,
		);
		this._maxBodySize = options?.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;
		this._idLength = options?.idLength ?? DEFAULT_ID_LENGTH;
		this._cleanupIntervalMs =
			options?.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
	}

	/** Keyv instance that stores the bins. */
	public get keyv(): Keyv<BinDocument> {
		return this._keyv;
	}

	/** Maximum captured body size in bytes. */
	public get maxBodySize(): number {
		return this._maxBodySize;
	}

	/** Maximum number of requests in one bin. */
	public get maxRequestsPerBin(): number {
		return this._maxRequestsPerBin;
	}

	/** Default bin lifetime in milliseconds. */
	public get defaultTtlMs(): number {
		return this._defaultTtlMs;
	}

	/**
	 * Create a new bin with the configured lifetime.
	 * Throws when Keyv does not store the bin.
	 */
	public async createBin(): Promise<Bin> {
		const id = this.generateId();
		const now = Date.now();
		const bin: Bin = {
			id,
			createdAt: new Date(now).toISOString(),
			expiresAt: new Date(now + this._defaultTtlMs).toISOString(),
			requestCount: 0,
		};
		await this.save({ bin, requests: [] });
		return bin;
	}

	/**
	 * Look up a bin by id.
	 * Returns `undefined` when the bin does not exist or Keyv has expired it.
	 */
	public async getBin(id: string): Promise<Bin | undefined> {
		const doc = await this._keyv.get(this.binKey(id));
		return doc?.bin;
	}

	/**
	 * List the bins that Keyv still holds.
	 * Throws when the Keyv store has no iterator.
	 */
	public async listBins(): Promise<Bin[]> {
		if (!this.canIterate()) {
			throw new Error(
				"MockHttpBins: the configured Keyv store does not support iteration; listBins() is unavailable",
			);
		}
		const bins: Bin[] = [];
		// Keyv 6 reads `this` inside iterator(). Keep the call on the instance.
		for await (const [key, value] of this._keyv.iterator()) {
			if (key.startsWith(BIN_KEY_PREFIX)) {
				bins.push((value as BinDocument).bin);
			}
		}
		return bins;
	}

	/**
	 * Delete a bin. Returns true when the bin existed.
	 * The delete waits for captures already queued for that bin, so a capture cannot write the bin back.
	 */
	public async deleteBin(id: string): Promise<boolean> {
		return this.enqueue(id, () => this._keyv.delete(this.binKey(id)));
	}

	/**
	 * Record a request for a bin.
	 * Returns `undefined` when the bin does not exist.
	 * Throws when Keyv does not store the capture.
	 */
	public async recordRequest(
		binId: string,
		raw: Omit<CapturedRequest, "id" | "binId" | "capturedAt">,
	): Promise<CapturedRequest | undefined> {
		const captured: CapturedRequest = {
			...raw,
			id: this.generateId(),
			binId,
			capturedAt: new Date().toISOString(),
		};
		const recorded = await this.enqueue(binId, () =>
			this.appendRequest(binId, captured),
		);
		return recorded ? captured : undefined;
	}

	/** List captured requests for a bin, newest first. */
	public async getRequests(binId: string): Promise<CapturedRequest[]> {
		const doc = await this._keyv.get(this.binKey(binId));
		return [...(doc?.requests ?? [])];
	}

	/** Look up one captured request. */
	public async getRequest(
		binId: string,
		reqId: string,
	): Promise<CapturedRequest | undefined> {
		const doc = await this._keyv.get(this.binKey(binId));
		return doc?.requests.find((request) => request.id === reqId);
	}

	/**
	 * Remove captured requests and keep the bin.
	 * Returns false when the bin does not exist.
	 * Throws when Keyv does not store the change.
	 */
	public async clearRequests(binId: string): Promise<boolean> {
		return this.enqueue(binId, async () => {
			const doc = await this._keyv.get(this.binKey(binId));
			if (!doc) {
				return false;
			}
			doc.requests = [];
			doc.bin.requestCount = 0;
			await this.save(doc);
			return true;
		});
	}

	/** Start the periodic removal of expired bins from the Keyv store. */
	public start(): void {
		if (this._cleanupTimer) {
			return;
		}
		this._cleanupTimer = setInterval(() => {
			void this.removeExpired().catch(() => undefined);
		}, this._cleanupIntervalMs);
		this._cleanupTimer.unref?.();
	}

	/** Stop the periodic cleanup. A second call does nothing. */
	public stop(): void {
		if (this._cleanupTimer) {
			clearInterval(this._cleanupTimer);
			this._cleanupTimer = undefined;
		}
	}

	/**
	 * The memory adapter deletes an expired key only when it reads that key.
	 * Walking the store deletes expired bins that nobody reads, without decoding them.
	 */
	private async removeExpired(): Promise<void> {
		const store = this._keyv.store;
		if (typeof store.iterator !== "function") {
			return;
		}
		for await (const _entry of store.iterator()) {
			// The adapter deletes expired entries during the walk.
		}
	}

	/** Keyv 6 yields nothing when the store has no iterator. Listing must fail instead. */
	private canIterate(): boolean {
		return typeof this._keyv.store.iterator === "function";
	}

	/** Returns false when the bin does not exist. */
	private async appendRequest(
		binId: string,
		captured: CapturedRequest,
	): Promise<boolean> {
		const doc = await this._keyv.get(this.binKey(binId));
		if (!doc) {
			return false;
		}
		doc.requests.unshift(captured);
		while (doc.requests.length > this._maxRequestsPerBin) {
			doc.requests.pop();
		}
		doc.bin.requestCount = doc.requests.length;
		await this.save(doc);
		return true;
	}

	/**
	 * Write a bin document with a TTL from its lifetime.
	 * Keyv returns false or throws when the write fails. Both cases throw here.
	 */
	private async save(doc: BinDocument): Promise<void> {
		const message = `MockHttpBins: could not save bin ${doc.bin.id}`;
		let saved: boolean;
		try {
			saved = await this._keyv.set(
				this.binKey(doc.bin.id),
				doc,
				this.ttlFor(doc.bin),
			);
		} catch (cause) {
			throw new Error(message, { cause });
		}
		if (!saved) {
			throw new Error(message);
		}
	}

	/**
	 * Run writes for one bin in order.
	 * A failed write does not block the next write for that bin.
	 */
	private enqueue<T>(id: string, fn: () => Promise<T>): Promise<T> {
		const previous = this._locks.get(id) ?? Promise.resolve();
		const run = previous.then(fn);
		const settled = run.then(
			() => undefined,
			() => undefined,
		);
		this._locks.set(id, settled);
		void settled.finally(() => {
			if (this._locks.get(id) === settled) {
				this._locks.delete(id);
			}
		});
		return run;
	}

	/** Keyv keeps a key without a TTL forever, so the TTL never drops below 1 ms. */
	private ttlFor(bin: Bin): number {
		return Math.max(1, Date.parse(bin.expiresAt) - Date.now());
	}

	private binKey(id: string): string {
		return `${BIN_KEY_PREFIX}${id}`;
	}

	private generateId(): string {
		return randomUUID().replaceAll("-", "").slice(0, this._idLength);
	}
}
