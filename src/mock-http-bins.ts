import {
	createHash,
	randomBytes,
	randomUUID,
	timingSafeEqual,
} from "node:crypto";
import Keyv from "keyv";
import type { Bin, CapturedRequest } from "./bin-store.js";
import { BinStoreFailure, isBinStoreFailure } from "./bin-store-diagnostics.js";

/**
 * One bin and its captured requests, stored as a single Keyv value.
 * `tokenHash` is the SHA-256 hex digest of the owner token.
 * The store does not keep the raw token.
 */
type BinDocument = {
	bin: Bin;
	tokenHash?: string;
	requests: CapturedRequest[];
};

const OWNER_TOKEN_BYTES = 32;
const ID_ATTEMPTS = 8;

/** SHA-256 digest of an owner token. */
function ownerTokenHash(token: string): Buffer {
	return createHash("sha256").update(token).digest();
}

/**
 * Compare a stored hash with the hash of a presented token.
 * The compare uses `timingSafeEqual`. A missing hash does not match.
 */
function ownerHashMatches(
	storedHex: string | undefined,
	token: string,
): boolean {
	const presented = ownerTokenHash(token);
	const parsed = Buffer.from(storedHex ?? "", "hex");
	const stored = Buffer.alloc(presented.length);
	if (parsed.length === presented.length) {
		stored.set(parsed);
	}
	const equal = timingSafeEqual(stored, presented);
	return parsed.length === presented.length && equal;
}

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
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_MAX_BODY_SIZE = 128 * 1024;
const DEFAULT_ID_LENGTH = 12;
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
	private readonly _locks = new Map<string, Promise<void>>();

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
	 * Create a bin and an owner token.
	 * The method returns the token once. The store keeps only the SHA-256 hash.
	 * Throws when Keyv does not store the bin.
	 */
	public async createBin(): Promise<Bin & { token: string }> {
		for (let attempt = 0; attempt < ID_ATTEMPTS; attempt++) {
			const id = this.generateId();
			const token = randomBytes(OWNER_TOKEN_BYTES).toString("base64url");
			const now = Date.now();
			const bin: Bin = {
				id,
				createdAt: new Date(now).toISOString(),
				expiresAt: new Date(now + this._defaultTtlMs).toISOString(),
				requestCount: 0,
			};
			const stored = await this.enqueue(id, async () => {
				const existing = await this._keyv.get(this.binKey(id));
				if (existing) {
					return false;
				}
				await this.save({
					bin,
					tokenHash: ownerTokenHash(token).toString("hex"),
					requests: [],
				});
				return true;
			});
			if (stored) {
				return { ...bin, token };
			}
		}
		throw new Error("MockHttpBins: could not allocate a unique bin id");
	}

	/**
	 * Return the bin when the owner token matches.
	 * A missing bin and a wrong token both fail.
	 * The result does not say which one occurred.
	 */
	public async authorizeOwner(
		id: string,
		token: string,
	): Promise<{ ok: true; bin: Bin } | { ok: false }> {
		const doc = await this._keyv.get(this.binKey(id));
		const matches = ownerHashMatches(doc?.tokenHash, token);
		if (!doc || !matches) {
			return { ok: false };
		}
		return { ok: true, bin: doc.bin };
	}

	/**
	 * Look up a bin by id.
	 * Returns `undefined` when the bin does not exist or Keyv has expired it.
	 * A failed read also returns `undefined` when the Keyv instance has an `error` listener.
	 */
	public async getBin(id: string): Promise<Bin | undefined> {
		const doc = await this._keyv.get(this.binKey(id));
		return doc?.bin;
	}

	/**
	 * List the bins that Keyv still holds.
	 * Throws when the Keyv store has no iterator.
	 * When the Keyv instance has an `error` listener, a failed walk returns the bins read before the error.
	 */
	public async listBins(): Promise<Bin[]> {
		this.requireIterator();
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
	 * List the bins that match this owner token.
	 * The method returns no other bins.
	 * Throws when the Keyv store has no iterator.
	 */
	public async listBinsForToken(token: string): Promise<Bin[]> {
		this.requireIterator();
		const bins: Bin[] = [];
		for await (const [key, value] of this._keyv.iterator()) {
			if (!key.startsWith(BIN_KEY_PREFIX)) {
				continue;
			}
			const doc = value as BinDocument;
			if (ownerHashMatches(doc.tokenHash, token)) {
				bins.push(doc.bin);
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

	/**
	 * Read captured requests when the token matches the current document.
	 * Return undefined when the bin is missing or the token does not match.
	 */
	public async readOwnedRequests(
		id: string,
		token: string,
	): Promise<CapturedRequest[] | undefined> {
		const doc = await this.ownedDocument(id, token);
		if (!doc) {
			return undefined;
		}
		return [...doc.requests];
	}

	/**
	 * Read one capture when the token matches the current document.
	 * `ok: false` means the bin is missing or the token does not match.
	 */
	public async readOwnedRequest(
		id: string,
		token: string,
		reqId: string,
	): Promise<
		{ ok: false } | { ok: true; request: CapturedRequest | undefined }
	> {
		const doc = await this.ownedDocument(id, token);
		if (!doc) {
			return { ok: false };
		}
		return {
			ok: true,
			request: doc.requests.find((request) => request.id === reqId),
		};
	}

	/**
	 * Clear captures when the token matches the current document.
	 * The check and the write share one lock, so a replacement bin is not cleared.
	 */
	public async clearOwnedRequests(id: string, token: string): Promise<boolean> {
		return this.enqueue(id, async () => {
			const doc = await this.ownedDocument(id, token);
			if (!doc) {
				return false;
			}
			doc.requests = [];
			doc.bin.requestCount = 0;
			await this.save(doc);
			return true;
		});
	}

	/**
	 * Delete a bin when the token matches the current document.
	 * The check and the delete share one lock, so a replacement bin stays.
	 */
	public async deleteOwnedBin(id: string, token: string): Promise<boolean> {
		return this.enqueue(id, async () => {
			const doc = await this.ownedDocument(id, token);
			if (!doc) {
				return false;
			}
			return this._keyv.delete(this.binKey(id));
		});
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

	/** Return the current document when the owner token matches. */
	private async ownedDocument(
		id: string,
		token: string,
	): Promise<BinDocument | undefined> {
		const doc = await this._keyv.get(this.binKey(id));
		if (!doc || !ownerHashMatches(doc.tokenHash, token)) {
			return undefined;
		}
		return doc;
	}

	/** Keyv 6 yields nothing when the store has no iterator. Listing must fail instead. */
	private canIterate(): boolean {
		return typeof this._keyv.store.iterator === "function";
	}

	/** Throw when the Keyv store has no iterator. */
	private requireIterator(): void {
		if (!this.canIterate()) {
			throw new Error(
				"MockHttpBins: the configured Keyv store does not support iteration; listBins() is unavailable",
			);
		}
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
			if (isBinStoreFailure(cause)) {
				throw new BinStoreFailure(`${message}. ${cause.message}`, cause);
			}
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
