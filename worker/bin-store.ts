import net from "node:net";
import KeyvMongo from "@keyv/mongo";
import Keyv from "keyv";
import { MongoClient, type MongoClientOptions } from "mongodb";
import {
	type BinHealth,
	isBinStoreConnectionFailure,
	logBinStore,
	mongoUriFacts,
	redactStoreError,
	toSafeStoreError,
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

const workerBinMongoOptions = {
	collection: "bins",
	maxPoolSize: 5,
	minPoolSize: 0,
	serverSelectionTimeoutMS: 5_000,
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

function watchMongoStore(store: object, uri: string, reset: () => void): void {
	const source = store as {
		on?: (event: "error", handler: (error: unknown) => void) => void;
		connect?: Promise<unknown>;
	};
	if (typeof source.on === "function") {
		source.on("error", (error) => {
			noteFailure("keyv.error", uri, error, reset);
		});
	}
	if (source.connect && typeof source.connect.then === "function") {
		const started = Date.now();
		void source.connect.then(
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
}

function logOpen(uri: string): void {
	const shape = uriShape(uri);
	const dirty = shape.extraAt || shape.whitespace || shape.wrappedQuotes;
	logBinStore({
		phase: "keyv.open",
		store: "keyv-mongo",
		uri,
		level: dirty ? "error" : "info",
		connected: !dirty,
	});
}

/**
 * Keyv uses MongoDB when a URI is set, and memory when it is not.
 * `@keyv/mongo` connects in its constructor. workerd rejects that network call
 * during isolate startup, so the client opens on the first bin operation.
 */
export function createAdaptiveBinKeyv(
	getUri: () => string | undefined,
): WorkerBinKeyv {
	let keyv: WorkerBinKeyv | undefined;
	let openedFor: string | undefined;
	const closing = new WeakSet<object>();

	const reset = (store: object) => {
		keyv = undefined;
		openedFor = undefined;
		if (closing.has(store)) {
			return;
		}
		closing.add(store);
		const disconnect = (store as { disconnect?: () => Promise<unknown> })
			.disconnect;
		if (typeof disconnect === "function") {
			void disconnect.call(store).catch(() => undefined);
		}
	};

	const open = (): WorkerBinKeyv => {
		const uri = getUri();
		if (!uri) {
			if (keyv && openedFor === undefined) {
				return keyv;
			}
			keyv = new Keyv() as WorkerBinKeyv;
			openedFor = undefined;
			return keyv;
		}
		if (keyv && openedFor === uri) {
			return keyv;
		}
		logOpen(uri);
		let store: KeyvMongo;
		try {
			store = new KeyvMongo(uri, workerBinMongoOptions);
		} catch (error) {
			logBinStore({ phase: "keyv.construct", store: "keyv-mongo", uri, error });
			throw toSafeStoreError(error, uri);
		}
		watchMongoStore(store, uri, () => reset(store));
		keyv = new Keyv({
			store: guardMongoStore(store, uri, () => reset(store)),
		}) as WorkerBinKeyv;
		openedFor = uri;
		return keyv;
	};

	return new Proxy({} as WorkerBinKeyv, {
		get(_target, property) {
			const target = open();
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
				scheme: facts.scheme,
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
				scheme: facts.scheme,
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
