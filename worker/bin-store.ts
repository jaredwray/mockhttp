import { AsyncLocalStorage } from "node:async_hooks";
import net from "node:net";
import KeyvMongo from "@keyv/mongo";
import Keyv, {
	type KeyvStorageCapability,
	type KeyvStorageEntry,
	type KeyvStorageGetResult,
	keyvStorageCapability,
} from "keyv";
import { MongoClient, type MongoClientOptions } from "mongodb";
import {
	type BinHealth,
	BinStoreFailure,
	isBinStoreConnectionFailure,
	logBinStore,
	mongoUriFacts,
	redactStoreError,
	toSafeStoreError,
	uriDiagnostics,
	uriShape,
} from "../src/bin-store-diagnostics.js";
import type { MockHttpBinsOptions } from "../src/mock-http-bins.js";

export const BIN_STORE_PING_TIMEOUT_MS = 2_000;

let socketProxyGuardInstalled = false;
const socketsWithError = new WeakSet<object>();

/**
 * workerd `node:net` emits `error` twice for one failed socket.
 * `cleanupAfterDestroy` emits the first time. The stream `destroy` callback emits again.
 * The driver listens with `once`, so the second emit has no listener and the isolate aborts.
 * The message differs for a proxy failure, a TLS failure, or a reset.
 * Drop a later `error` that has no listener. The first `error` still uses Node behavior.
 * `tls.TLSSocket` uses this `emit`.
 */
export function installSocketProxyGuard(): void {
	if (socketProxyGuardInstalled) {
		return;
	}
	socketProxyGuardInstalled = true;
	const proto = net.Socket.prototype as net.Socket & {
		emit(event: string | symbol, ...args: unknown[]): boolean;
	};
	const emit = proto.emit;
	proto.emit = function (
		this: net.Socket,
		event: string | symbol,
		...args: unknown[]
	) {
		if (event === "error") {
			const repeat = socketsWithError.has(this);
			socketsWithError.add(this);
			if (repeat && this.listenerCount("error") === 0) {
				return false;
			}
		}
		return emit.call(this, event, ...args);
	};
}

installSocketProxyGuard();

/**
 * One client serves one request, so one pooled connection is enough.
 * The short timeouts keep a bad Atlas host from holding a request open.
 */
const workerBinMongoOptions = {
	collection: "bins",
	maxPoolSize: 1,
	minPoolSize: 0,
	serverSelectionTimeoutMS: 5_000,
	connectTimeoutMS: 5_000,
};

type WorkerBinKeyv = NonNullable<MockHttpBinsOptions["keyv"]>;

const MONGO_METHODS = new Set([
	"get",
	"set",
	"delete",
	"clear",
	"has",
	"getMany",
	"setMany",
	"deleteMany",
	"hasMany",
	"disconnect",
]);

type StoreMethod = (...args: unknown[]) => unknown;

function noteFailure(
	phase: string,
	uri: string,
	error: unknown,
	reset: () => void,
): void {
	logBinStore({ phase, store: "keyv-mongo", uri, error });
	if (isBinStoreConnectionFailure(error)) {
		reset();
	}
}

/**
 * Wrap a KeyvMongo store. Log each failed Keyv operation without the URI or credentials.
 * Drop a failed client so the next operation opens a new client.
 */
export function guardMongoStore(
	store: object,
	uri: string,
	reset: () => void,
): object {
	return new Proxy(store, {
		get(target, property, receiver) {
			const value = Reflect.get(target, property, receiver);
			if (property === "iterator" && typeof value === "function") {
				const iterate = value as StoreMethod;
				return async function* (...args: unknown[]) {
					try {
						yield* iterate.apply(target, args) as AsyncIterable<unknown>;
					} catch (error) {
						noteFailure("keyv.iterator", uri, error, reset);
						throw toSafeStoreError(error, uri);
					}
				};
			}
			if (
				typeof property === "string" &&
				MONGO_METHODS.has(property) &&
				typeof value === "function"
			) {
				const call = value as StoreMethod;
				return async (...args: unknown[]) => {
					try {
						const result = await call.apply(target, args);
						if (property === "set" && result === false) {
							logBinStore({
								phase: "keyv.set",
								store: "keyv-mongo",
								uri,
								error: new Error("Keyv store set returned false"),
							});
						}
						return result;
					} catch (error) {
						noteFailure(`keyv.${property}`, uri, error, reset);
						throw toSafeStoreError(error, uri);
					}
				};
			}
			if (typeof value === "function") {
				return value.bind(target);
			}
			return value;
		},
	});
}

type ErrorHandler = (error: unknown) => void;

function watchMongoStore(
	store: KeyvMongo,
	uri: string,
	reset: () => void,
	forward: readonly ErrorHandler[],
): void {
	store.on("error", (error: unknown) => {
		noteFailure("keyv.error", uri, error, reset);
		for (const handler of forward) {
			handler(error);
		}
	});
	const started = Date.now();
	void store.connect.then(
		() => {
			logBinStore({
				phase: "keyv.connect",
				store: "keyv-mongo",
				uri,
				level: "info",
				connected: true,
				latencyMs: Date.now() - started,
			});
		},
		(error: unknown) => {
			noteFailure("keyv.connect", uri, error, reset);
		},
	);
}

function logDirtyUri(uri: string): void {
	const shape = uriShape(uri);
	if (shape.extraAt || shape.whitespace || shape.wrappedQuotes) {
		logBinStore({
			phase: "keyv.open",
			store: "keyv-mongo",
			uri,
			connected: false,
		});
	}
}

/** One MongoDB client. It serves one request, or one operation outside a request. */
type BinStoreClient = {
	readonly uri: string;
	readonly store: KeyvMongo;
	readonly guarded: KeyvMongo;
};

/**
 * The bin store work of one Worker request.
 * workerd ties a socket to the request that opened it. A client that one request
 * opened cannot serve a later request, and the driver cannot keep monitoring it
 * after that request ends. So the client lives in this scope and closes with it.
 */
export type BinStoreScope = {
	client: BinStoreClient | undefined;
	closed: boolean;
	readonly pending: Set<Promise<unknown>>;
};

const scopeStorage = new AsyncLocalStorage<BinStoreScope>();

export function createBinStoreScope(): BinStoreScope {
	return { client: undefined, closed: false, pending: new Set() };
}

/** Run `fn` so that every bin operation inside it shares the scope's client. */
export function runInBinStoreScope<T>(
	scope: BinStoreScope,
	fn: () => Promise<T>,
): Promise<T> {
	return scopeStorage.run(scope, fn);
}

/** The scope of the current request, if one is active. */
export function currentBinStoreScope(): BinStoreScope | undefined {
	return scopeStorage.getStore();
}

async function disconnectClient(client: BinStoreClient): Promise<void> {
	// A client whose connect failed has no open topology. The driver closed it.
	const connected = await client.store.connect.then(
		() => true,
		() => false,
	);
	if (!connected) {
		return;
	}
	try {
		await client.store.disconnect();
	} catch (error) {
		logBinStore({
			phase: "keyv.close",
			store: "keyv-mongo",
			uri: client.uri,
			error,
		});
	}
}

/**
 * Close the scope's client. Operations still running in the scope finish first.
 * An operation that starts after this call opens and closes its own client.
 * This never rejects, so it is safe to hand to `ctx.waitUntil`.
 */
export async function closeBinStoreScope(scope: BinStoreScope): Promise<void> {
	scope.closed = true;
	while (scope.pending.size > 0) {
		const batch = [...scope.pending];
		await Promise.allSettled(batch);
		for (const task of batch) {
			scope.pending.delete(task);
		}
	}
	const client = scope.client;
	scope.client = undefined;
	if (client) {
		await disconnectClient(client);
	}
}

function trackPending<T>(scope: BinStoreScope, task: Promise<T>): Promise<T> {
	const settled = task.then(
		() => undefined,
		() => undefined,
	);
	scope.pending.add(settled);
	return task;
}

function openClient(
	uri: string,
	scope: BinStoreScope,
	forward: readonly ErrorHandler[],
): BinStoreClient {
	logDirtyUri(uri);
	let store: KeyvMongo;
	try {
		store = new KeyvMongo(uri, workerBinMongoOptions);
	} catch (error) {
		logBinStore({ phase: "keyv.construct", store: "keyv-mongo", uri, error });
		throw toSafeStoreError(error, uri);
	}
	// A connection failure drops the client. The next operation in this scope
	// opens a new one. The close runs inside the scope so the request waits for it.
	const reset = (): void => {
		if (scope.client !== client) {
			return;
		}
		scope.client = undefined;
		trackPending(scope, disconnectClient(client));
	};
	const client: BinStoreClient = {
		uri,
		store,
		guarded: guardMongoStore(store, uri, reset) as KeyvMongo,
	};
	watchMongoStore(store, uri, reset, forward);
	return client;
}

/**
 * Keyv storage adapter that opens a MongoDB client per request.
 * Inside {@link runInBinStoreScope}, operations share the request's client.
 * Outside a scope, an operation opens a client and closes it when done.
 * Nothing is kept at module scope, so no socket outlives its request.
 */
export class RequestScopedMongoStore {
	namespace?: string | undefined;
	private readonly _listeners: ErrorHandler[] = [];
	private readonly _getUri: () => string | undefined;

	constructor(getUri: () => string | undefined) {
		this._getUri = getUri;
	}

	get capabilities(): KeyvStorageCapability {
		return keyvStorageCapability(this);
	}

	/** Keyv forwards store errors to its own `error` event through this. */
	on(event: string, handler: ErrorHandler): this {
		if (event === "error") {
			this._listeners.push(handler);
		}
		return this;
	}

	async get<Value>(key: string): Promise<KeyvStorageGetResult<Value>> {
		return this.run((store) => store.get<Value>(key));
	}

	async getMany<Value>(
		keys: string[],
	): Promise<Array<KeyvStorageGetResult<Value>>> {
		return this.run((store) => store.getMany<Value>(keys));
	}

	async has(key: string): Promise<boolean> {
		return this.run((store) => store.has(key));
	}

	async hasMany(keys: string[]): Promise<boolean[]> {
		return this.run((store) => store.hasMany(keys));
	}

	async set(key: string, value: unknown, expires?: number): Promise<boolean> {
		return this.run((store) => store.set(key, value, expires));
	}

	async setMany<Value>(
		entries: KeyvStorageEntry<Value>[],
	): Promise<boolean[] | undefined> {
		return this.run((store) => store.setMany(entries));
	}

	async delete(key: string): Promise<boolean> {
		return this.run((store) => store.delete(key));
	}

	async deleteMany(keys: string[]): Promise<boolean[]> {
		return this.run((store) => store.deleteMany(keys));
	}

	async clear(): Promise<void> {
		return this.run((store) => store.clear());
	}

	/** Close the current request's client. There is nothing to close outside a request. */
	async disconnect(): Promise<void> {
		const scope = scopeStorage.getStore();
		if (scope) {
			await closeBinStoreScope(scope);
		}
	}

	async *iterator(): AsyncGenerator<[string, unknown], void> {
		const scope = scopeStorage.getStore();
		if (scope && !scope.closed) {
			const running = Promise.withResolvers<void>();
			scope.pending.add(running.promise);
			try {
				yield* this.clientFor(scope).guarded.iterator() as AsyncIterable<
					[string, unknown]
				>;
			} finally {
				running.resolve();
			}
			return;
		}
		const own = createBinStoreScope();
		try {
			yield* this.clientFor(own).guarded.iterator() as AsyncIterable<
				[string, unknown]
			>;
		} finally {
			await closeBinStoreScope(own);
		}
	}

	private async run<T>(op: (store: KeyvMongo) => Promise<T>): Promise<T> {
		const scope = scopeStorage.getStore();
		if (scope && !scope.closed) {
			return trackPending(scope, op(this.clientFor(scope).guarded));
		}
		const own = createBinStoreScope();
		try {
			return await op(this.clientFor(own).guarded);
		} finally {
			await closeBinStoreScope(own);
		}
	}

	private clientFor(scope: BinStoreScope): BinStoreClient {
		if (!scope.client) {
			const uri = this._getUri();
			if (!uri) {
				throw new BinStoreFailure("MONGODB_URI is not set");
			}
			scope.client = openClient(uri, scope, this._listeners);
		}
		return scope.client;
	}
}

/**
 * Keyv uses MongoDB when a URI is set, and memory when it is not.
 * The MongoDB client opens on the first bin operation of a request and closes
 * when that request ends. Nothing connects while the isolate starts.
 */
export function createAdaptiveBinKeyv(
	getUri: () => string | undefined,
): WorkerBinKeyv {
	const memory = new Keyv() as WorkerBinKeyv;
	const mongo = new Keyv({
		store: new RequestScopedMongoStore(getUri),
	}) as WorkerBinKeyv;

	return new Proxy({} as WorkerBinKeyv, {
		get(_target, property) {
			const target = getUri() ? mongo : memory;
			const value = Reflect.get(target, property, target);
			if (typeof value === "function") {
				return value.bind(target);
			}
			return value;
		},
	});
}

const pingOptions: MongoClientOptions = {
	serverSelectionTimeoutMS: BIN_STORE_PING_TIMEOUT_MS,
	connectTimeoutMS: BIN_STORE_PING_TIMEOUT_MS,
	socketTimeoutMS: BIN_STORE_PING_TIMEOUT_MS,
	maxPoolSize: 1,
	minPoolSize: 0,
};

/** Admin ping. The client always closes. A failed client is not kept. */
export async function pingMongoBinStore(uri: string): Promise<BinHealth> {
	const facts = mongoUriFacts(uri);
	const started = Date.now();
	let client: MongoClient | undefined;
	try {
		client = new MongoClient(uri, pingOptions);
		await client.db("admin").command({ ping: 1 });
		return {
			status: "ok",
			bins: {
				store: "mongo",
				connected: true,
				latencyMs: Date.now() - started,
				uriPresent: facts.present,
				uri: uriDiagnostics(uri),
			},
		};
	} catch (error) {
		logBinStore({ phase: "healthz", store: "keyv-mongo", uri, error });
		return {
			status: "error",
			bins: {
				store: "mongo",
				connected: false,
				uriPresent: facts.present,
				uri: uriDiagnostics(uri),
				error: redactStoreError(error, uri),
			},
		};
	} finally {
		if (client) {
			await client.close().catch((error: unknown) => {
				logBinStore({
					phase: "healthz.close",
					store: "keyv-mongo",
					uri,
					error,
				});
			});
		}
	}
}

export const binStoreRuntime = {
	ping(uri: string): Promise<BinHealth> {
		return pingMongoBinStore(uri);
	},
};
